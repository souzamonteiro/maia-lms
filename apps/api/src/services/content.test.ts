import { describe, it, expect } from 'vitest';
import { renderContent } from './content.js';

describe('lesson content renderer',()=>{
  it('keeps existing plain text literal',()=>{
    expect(renderContent('# Heading\n<script>alert(1)</script>','plain')).toBe('<div class="plain-content"># Heading\n&lt;script&gt;alert(1)&lt;/script&gt;</div>');
  });
  it('renders Markdown headings, lists, code and tables',()=>{
    const html=renderContent('## Heading\n\n**Bold** and *italic*\n\n- Item\n\n```js\n<danger>\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |','markdown');
    for(const tag of ['<h2>','<strong>','<em>','<ul>','<pre>','<code>','<table>'])expect(html).toContain(tag);
    expect(html).toContain('&lt;danger&gt;');
  });
  it('never allows raw HTML, executable links or remote tracking images',()=>{
    const html=renderContent('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![remote](https://evil.example/pixel)\n\n![local](/static/example.png)\n\n<iframe src="https://evil.example"></iframe>','markdown');
    expect(html).not.toMatch(/<(script|iframe)|onerror="|href="javascript:|<img[^>]*src="https:\/\/evil/);
    expect(html).toContain('src="/static/example.png"');
    expect(html).toContain('alt="local"');
    expect(html).toContain('&lt;script&gt;');
  });
});
