if (process.argv[2] === 'gateway') console.log('GATEWAY STARTED');
const timer = setInterval(() => {}, 1000);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  setTimeout(() => { console.log('CLEANED'); clearInterval(timer); }, 100);
});
console.log('READY');
