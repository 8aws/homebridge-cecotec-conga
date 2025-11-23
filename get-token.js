const axios = require('axios');

async function getToken() {
  const email = await new Promise(resolve => {
    process.stdout.write('Email de la app Cecotec: ');
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
  const password = await new Promise(resolve => {
    process.stdout.write('Contraseña de la app Cecotec: ');
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
      process.stdin.pause();
    });
  });

  try {
    const response = await axios.post('https://cloud.eu.cecotec.es/api/v1/auth/login', { email, password });
    console.log('\n¡TOKEN OBTENIDO! (cópialo completo al config):');
    console.log(response.data.token);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getToken();