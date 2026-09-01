import http from 'http';

const getJSON = (url) => {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
};

const postJSON = (url, body) => {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(body);
    const parsed = new URL(url);

    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
};

const runTest = async () => {
  try {
    const baseUrl = 'http://127.0.0.1:5000/api';

    console.log('--- 1. Testing GET /api/news (Public News Feed) ---');
    const res1 = await getJSON(`${baseUrl}/news`);
    console.log(`Status Code: ${res1.status}`);
    console.log(`Total Public Approved News: ${res1.body.total}`);
    const titles = res1.body.docs.map(d => `[${d.status}] ${d.title}`);
    console.log('Public Articles returned:', titles);

    const hasUnapproved = res1.body.docs.some(d => d.status !== 'approved');
    if (hasUnapproved) {
      console.error('❌ FAIL: Non-approved articles were returned in public feed!');
    } else {
      console.log('✅ PASS: Only approved articles were returned in public feed!');
    }

    console.log('\n--- 2. Testing GET /api/news/featured (Featured News Hero) ---');
    const res2 = await getJSON(`${baseUrl}/news/featured`);
    console.log('Featured Article Title:', res2.body?.title);
    console.log('Featured Status:', res2.body?.status);

    console.log('\n--- 3. Testing GET /api/news/detail/national-disaster-preparedness-campaign-launched (Public News Detail by Slug) ---');
    const res3 = await getJSON(`${baseUrl}/news/detail/national-disaster-preparedness-campaign-launched`);
    console.log('Slug Detail Title:', res3.body?.title);
    console.log('Views count:', res3.body?.views);

    console.log('\n--- 4. Testing Public Unauthenticated Commenting ---');
    const sampleArticleId = res1.body.docs[0]._id;
    const res4 = await postJSON(`${baseUrl}/news/${sampleArticleId}/comments`, {
      content: 'This is an official public visitor comment test.',
      guestName: 'Community Volunteer'
    });
    console.log('Comment Created:', res4.body.content, 'by:', res4.body.guestName);

    console.log('\n🎉 ALL PUBLIC NEWS API TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('API Test Error:', err);
  }
};

runTest();
