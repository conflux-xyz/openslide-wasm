import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

class RequestHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        original_path = super().translate_path(path)
        if os.path.exists(original_path):
            return original_path
        
        # include files in /dist
        dist_dir = os.path.abspath(os.path.join(os.getcwd(), "./dist/"))
        alternative_path = os.path.join(dist_dir, path.lstrip("/"))
        if os.path.exists(alternative_path):
            return alternative_path
        
        # include files in /tests
        test_dir = os.path.abspath(os.path.join(os.getcwd(), "./tests/"))
        tests_path = os.path.join(test_dir, path.lstrip("/"))
        if os.path.exists(tests_path):
            return tests_path
        return original_path

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

if __name__ == "__main__":
    HTTPServer(("localhost", 8080), RequestHandler).serve_forever()