#!/usr/bin/env python3
"""Render the LMS VPS site without changing services or VPN state."""
import argparse
import ipaddress
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--domain', default='learn.maiaplatform.org')
parser.add_argument('--upstream', required=True)
parser.add_argument('--cert')
parser.add_argument('--key')
parser.add_argument('--acme-only', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}', args.domain):
    parser.error('Invalid domain')
try:
    host, port = args.upstream.split(':')
    address = ipaddress.IPv4Address(host)
    if address.is_unspecified or address.is_multicast or not 1 <= int(port) <= 65535:
        raise ValueError()
except ValueError:
    parser.error('Use an IPv4:port upstream')
cert = args.cert or f'/etc/letsencrypt/live/{args.domain}/fullchain.pem'
key = args.key or f'/etc/letsencrypt/live/{args.domain}/privkey.pem'
for value in (cert, key):
    if not re.fullmatch(r'/[a-zA-Z0-9_./-]+', value):
        parser.error('Certificate paths must be absolute, without spaces or Nginx syntax')
source = Path(__file__).resolve().parent.parent / 'deploy/nginx'
text = (source / ('learn-acme.conf.template' if args.acme_only else 'learn-vps.conf.template')).read_text()
for token, value in [('DOMAIN', args.domain), ('UPSTREAM', f'{address}:{int(port)}'), ('CERT', cert), ('KEY', key)]:
    text = text.replace(f'__{token}__', value)
print(text, end='')
