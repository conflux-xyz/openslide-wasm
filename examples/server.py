from http.server import SimpleHTTPRequestHandler, HTTPServer

class CORPHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

if __name__ == "__main__":
    HTTPServer(("localhost", 8000), CORPHandler).serve_forever()
