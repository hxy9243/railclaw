export async function smoke(baseUrl = `http://127.0.0.1:${process.env.PORT || '8080'}`) {
  const url = baseUrl.replace(/\/+$/, '');
  for (const endpoint of ['/healthz', '/readyz']) {
    const target = `${url}${endpoint}`;
    console.log(`checking ${target}`);
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`${target} returned ${response.status}`);
    }
  }
  console.log('smoke: ok');
}
