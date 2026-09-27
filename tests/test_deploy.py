"""Run with python3 tests/test_deploy.py; does not touch system configuration."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class DeploymentTests(unittest.TestCase):
    def render(self, *args):
        return subprocess.run(['python3', str(ROOT/'scripts/render-nginx.py'), *args], capture_output=True, text=True)

    def test_default_https_and_acme(self):
        result = self.render('--upstream', '10.77.0.2:3200')
        self.assertEqual(result.returncode, 0)
        self.assertIn('proxy_pass http://10.77.0.2:3200;', result.stdout)
        self.assertIn('return 301 https://learn.maiaplatform.org$request_uri;', result.stdout)
        self.assertIn('proxy_set_header X-Forwarded-Proto $scheme;', result.stdout)
        result = self.render('--upstream', '10.77.0.2:3200', '--acme-only')
        self.assertNotIn('proxy_pass', result.stdout)
        self.assertNotIn('listen 443', result.stdout)
        self.assertIn('/.well-known/acme-challenge/', result.stdout)

    def test_invalid_values(self):
        for upstream in ['999.0.0.1:3200', '10.77.0.2:99999', '10.77.0.2:3200;bad']:
            self.assertNotEqual(self.render('--upstream', upstream).returncode, 0)
        self.assertNotEqual(self.render('--upstream', '10.77.0.2:3200', '--domain', 'evil;include').returncode, 0)
        self.assertNotEqual(self.render('--upstream', '10.77.0.2:3200', '--cert', '/tmp/a;bad').returncode, 0)

    @unittest.skipUnless(shutil.which('nginx') and shutil.which('openssl'), 'Nginx and OpenSSL required')
    def test_real_nginx_syntax(self):
        with tempfile.TemporaryDirectory(prefix='maia-lms-nginx-') as directory:
            root = pathlib.Path(directory)
            cert, key = str(root/'cert.pem'), str(root/'key.pem')
            subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=learn.maiaplatform.org', '-keyout', key, '-out', cert], check=True, capture_output=True)
            for extra in [[], ['--acme-only']]:
                result = self.render('--upstream', '10.77.0.2:3200', '--cert', cert, '--key', key, *extra)
                self.assertEqual(result.returncode, 0)
                config = root/'nginx.conf'
                # Use unprivileged ports for the local syntax check.
                rendered = result.stdout.replace('listen 80;', 'listen 18080;').replace('listen 443 ssl;', 'listen 18443 ssl;')
                config.write_text(f'error_log stderr; pid {root}/nginx.pid; events {{}} http {{ access_log off;\n{rendered}\n}}')
                result = subprocess.run(['nginx', '-t', '-e', 'stderr', '-p', directory, '-c', str(config)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

if __name__ == '__main__':
    unittest.main()
