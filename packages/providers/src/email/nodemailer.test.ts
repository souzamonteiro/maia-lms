import { it, expect } from 'vitest';
import net from 'node:net';
import { once } from 'node:events';
import { NodemailerEmailProvider } from './nodemailer.js';

it('delivers a message to the configured SMTP server', async () => {
  const messages: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');
    let buffer = '';
    let inData = false;
    let message = '';
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            messages.push(message);
            inData = false;
            socket.write('250 accepted\r\n');
          } else message += line + '\r\n';
        } else if (line.startsWith('EHLO') || line.startsWith('HELO')) {
          socket.write('250-localhost\r\n250 SIZE 1048576\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address() as net.AddressInfo;
    const provider = new NodemailerEmailProvider(`smtp://127.0.0.1:${port}`, 'noreply@example.com');
    await provider.send({ to: 'learner@example.com', subject: 'Verify account', text: 'Hello learner' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('To: learner@example.com');
    expect(messages[0]).toContain('Hello learner');
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
