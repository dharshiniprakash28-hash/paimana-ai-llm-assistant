"""
JSX structural checker, v2.

No node_modules are available in this container, so this stands in for a build.
v1 was wrong in two ways and reported false positives on untouched files:
  * template literals emitted an unmatched '${'
  * the tag regex stopped at the first '>', so any attribute containing an
    arrow function (onChange={(e) => ...}) truncated the tag

v2 scans character by character with a real state machine. It checks:
  1. bracket balance  ( ) [ ] { }   outside strings and comments
  2. JSX element nesting, where a tag is read by walking from '<' to its
     matching '>' while respecting nested braces, parens and strings.

Validated against the pristine files from the uploaded archive: every file must
report OK before the checker is trusted to judge an edit.
"""
import sys

PAIRS = {')': '(', ']': '[', '}': '{'}
NAME_START = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$')
NAME_CHARS = NAME_START | set('0123456789.-')


class Scanner:
    def __init__(self, src, path):
        self.s = src
        self.n = len(src)
        self.path = path
        self.errors = []

    def line_at(self, i):
        return self.s.count('\n', 0, i) + 1

    def err(self, i, msg):
        self.errors.append(f'{self.path}:{self.line_at(i)}: {msg}')

    # -- primitives -------------------------------------------------------
    def skip_string(self, i):
        """i points at a quote char. Return index just past the closing quote."""
        q = self.s[i]
        i += 1
        while i < self.n:
            c = self.s[i]
            if c == '\\':
                i += 2
                continue
            if q == '`' and c == '$' and i + 1 < self.n and self.s[i + 1] == '{':
                # template substitution: recurse over balanced braces
                i = self.skip_balanced(i + 1, '{', '}')
                continue
            if c == q:
                return i + 1
            i += 1
        return i

    def skip_comment(self, i):
        if self.s[i:i + 2] == '//':
            j = self.s.find('\n', i)
            return self.n if j == -1 else j
        j = self.s.find('*/', i + 2)
        return self.n if j == -1 else j + 2

    def skip_balanced(self, i, open_ch, close_ch):
        """i points at open_ch. Return index just past its match."""
        depth = 0
        while i < self.n:
            c = self.s[i]
            if c in '"\'`':
                i = self.skip_string(i)
                continue
            if self.s[i:i + 2] in ('//', '/*'):
                i = self.skip_comment(i)
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return i + 1
            i += 1
        return i

    # -- checks -----------------------------------------------------------
    def check_brackets(self):
        stack = []
        i = 0
        while i < self.n:
            c = self.s[i]
            if c in '"\'`':
                i = self.skip_string(i)
                continue
            if self.s[i:i + 2] in ('//', '/*'):
                i = self.skip_comment(i)
                continue
            if c in '([{':
                stack.append((c, i))
            elif c in ')]}':
                if not stack:
                    self.err(i, f'stray closing {c!r}')
                elif stack[-1][0] != PAIRS[c]:
                    op, oi = stack.pop()
                    self.err(i, f'{c!r} closes {op!r} opened at line {self.line_at(oi)}')
                else:
                    stack.pop()
            i += 1
        for op, oi in stack:
            self.errors.append(
                f'{self.path}: unclosed {op!r} opened at line {self.line_at(oi)}')

    def read_tag(self, i):
        """
        i points at '<'. Returns (kind, name, end_index) where kind is
        'open', 'close', 'self' or None if this '<' is not a tag.
        """
        j = i + 1
        while j < self.n and self.s[j] in ' \t\n':
            j += 1
        closing = False
        if j < self.n and self.s[j] == '/':
            closing = True
            j += 1
            while j < self.n and self.s[j] in ' \t\n':
                j += 1
        if j >= self.n or self.s[j] not in NAME_START:
            # <> fragment, or a less-than operator
            if j < self.n and self.s[j] == '>':
                return ('frag_close' if closing else 'frag_open'), '<>', j + 1
            return None, None, i + 1
        start = j
        while j < self.n and self.s[j] in NAME_CHARS:
            j += 1
        name = self.s[start:j]

        # Disambiguate a real tag from a less-than comparison such as
        # `{step < demoSteps.length - 1 && (`. No JSX attribute list can begin
        # with a binary operator, so if the next non-space char is one, this
        # '<' was arithmetic, not a tag.
        k = j
        while k < self.n and self.s[k] in ' \t\n':
            k += 1
        if k < self.n and self.s[k] in '-+*%&|?:,;)=<':
            return None, None, j

        # walk attributes to the matching '>'
        while j < self.n:
            c = self.s[j]
            if c in '"\'`':
                j = self.skip_string(j)
                continue
            if c == '{':
                j = self.skip_balanced(j, '{', '}')
                continue
            if c == '(':
                j = self.skip_balanced(j, '(', ')')
                continue
            if c == '/' and self.s[j:j + 2] in ('//', '/*'):
                j = self.skip_comment(j)
                continue
            if c == '/' and j + 1 < self.n:
                k = j + 1
                while k < self.n and self.s[k] in ' \t\n':
                    k += 1
                if k < self.n and self.s[k] == '>':
                    return 'self', name, k + 1
            if c == '>':
                return ('close' if closing else 'open'), name, j + 1
            j += 1
        return None, name, j

    def check_tags(self):
        stack = []
        i = 0
        while i < self.n:
            c = self.s[i]
            if c in '"\'`':
                i = self.skip_string(i)
                continue
            if self.s[i:i + 2] in ('//', '/*'):
                i = self.skip_comment(i)
                continue
            if c == '<':
                kind, name, end = self.read_tag(i)
                if kind in ('open', 'frag_open'):
                    stack.append((name, i))
                elif kind in ('close', 'frag_close'):
                    if not stack:
                        self.err(i, f'closing </{name}> with nothing open')
                    elif stack[-1][0] != name:
                        on, oi = stack.pop()
                        self.err(i, f'</{name}> does not match <{on}> '
                                    f'opened at line {self.line_at(oi)}')
                    else:
                        stack.pop()
                i = end
                continue
            i += 1
        for name, oi in stack:
            self.errors.append(
                f'{self.path}: <{name}> opened at line {self.line_at(oi)} never closed')


def check(path):
    with open(path, encoding='utf-8') as fh:
        src = fh.read()
    sc = Scanner(src, path)
    sc.check_brackets()
    sc.check_tags()
    return sc.errors


def main(paths):
    bad = 0
    for p in paths:
        errs = check(p)
        if errs:
            bad += 1
            print(f'FAIL {p}')
            for e in errs[:12]:
                print('   ', e)
        else:
            print(f'OK   {p}')
    print(f'\n{len(paths) - bad}/{len(paths)} files structurally valid')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
