#!/usr/bin/env python3
"""
node shim: A fake 'node' binary that yt-dlp calls for JS challenge solving.
Internally uses py-mini-racer (V8) to execute the JS, so no actual Node.js needed.
Reads JS from stdin, executes it, writes result to stdout.
"""
import sys
import os

# Handle --version flag (yt-dlp checks this to detect node)
if '--version' in sys.argv:
    print('v22.12.0')
    sys.exit(0)

# V8 setup: add print() and console.log() capture
V8_PRELUDE = r'''
var __output_lines = [];
var print = function() {
    var args = Array.prototype.slice.call(arguments);
    __output_lines.push(args.join(' '));
};
var console = { log: print, error: function(){} };
'''

def main():
    try:
        from py_mini_racer import MiniRacer

        # Read JS from stdin (yt-dlp pipes challenge scripts here)
        js_code = sys.stdin.read()
        if not js_code:
            sys.exit(0)

        ctx = MiniRacer()

        # Add print/console stubs that capture output
        ctx.eval(V8_PRELUDE)

        # Execute the JS
        result = ctx.eval(js_code)

        # Check captured print() output first
        try:
            captured = ctx.eval('__output_lines.join("\\n")')
        except Exception:
            captured = None

        if captured:
            sys.stdout.write(str(captured))
            sys.stdout.write('\n')
            sys.stdout.flush()
        elif result is not None and str(result) != 'undefined':
            sys.stdout.write(str(result))
            sys.stdout.write('\n')
            sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(str(e) + '\n')
        sys.exit(1)


if __name__ == '__main__':
    main()
