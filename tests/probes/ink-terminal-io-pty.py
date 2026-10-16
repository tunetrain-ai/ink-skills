#!/usr/bin/env python3
# Runs a command on a real pseudo-terminal and relays it as JSON lines, so a claim can drive
# a genuine TTY (window size, SIGWINCH, raw mode, Ctrl+C) without any native Node module.
#
#   ink-terminal-io-pty.py <cols> <rows> <cwd> <env-json> <argv...>
#
# stdin  (one JSON object per line):  {"write": "<text>"}  {"resize": [cols, rows]}  {"hangup": true}
# stdout (one JSON object per line):  {"out": "<text>"}  {"exit": <code>, "signal": <number|null>}
import fcntl, json, os, pty, select, signal, struct, sys, termios

cols, rows, cwd, env_json = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
argv = sys.argv[5:]

def set_size(fd, cols, rows):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))

pid, master = pty.fork()
if pid == 0:
    set_size(0, cols, rows)
    os.chdir(cwd)
    os.execvpe(argv[0], argv, json.loads(env_json))

def emit(obj):
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()

stdin_fd = sys.stdin.fileno()
pending = b''
status = None
open_stdin = True
while True:
    watch = [master] + ([stdin_fd] if open_stdin else [])
    ready, _, _ = select.select(watch, [], [], 0.05)
    if master in ready:
        try:
            data = os.read(master, 65536)
        except OSError:
            data = b''
        if data:
            emit({'out': data.decode('utf-8', 'replace')})
        else:
            break
    if open_stdin and stdin_fd in ready:
        chunk = os.read(stdin_fd, 65536)
        if not chunk:
            open_stdin = False
        pending += chunk
        while b'\n' in pending:
            line, pending = pending.split(b'\n', 1)
            if not line.strip():
                continue
            cmd = json.loads(line)
            if 'write' in cmd:
                os.write(master, cmd['write'].encode())
            elif 'resize' in cmd:
                set_size(master, cmd['resize'][0], cmd['resize'][1])
            elif cmd.get('hangup'):
                os.close(master)
                break
_, status = os.waitpid(pid, 0)
emit({'exit': os.WEXITSTATUS(status) if os.WIFEXITED(status) else None, 'signal': os.WTERMSIG(status) if os.WIFSIGNALED(status) else None})
