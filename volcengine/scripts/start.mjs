process.env.HOSTNAME = '0.0.0.0';
process.env.PORT ||= '3000';
await import('../.next/standalone/server.js');
