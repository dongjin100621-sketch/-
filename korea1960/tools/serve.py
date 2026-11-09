"""Local-only development server. Does not expose the folder on the LAN.
python3 tools/serve.py              # game/ (현재 게임, 분리 소스)
python3 tools/serve.py --reference  # example/ (제작 패키지 v1 참조 구현)
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import functools, webbrowser, argparse
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--no-open',action='store_true');p.add_argument('--reference',action='store_true');args=p.parse_args()
url=f'http://127.0.0.1:{args.port}/'+('example/' if args.reference else 'game/')
print(f'Open: {url}\nStop: Ctrl+C',flush=True)
server=ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(SimpleHTTPRequestHandler,directory=str(root)))
if not args.no_open:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
