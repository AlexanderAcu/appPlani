// set-admin-claim.js
// Uso: node set-admin-claim.js <UID> [path/to/serviceAccountKey.json]
// Si no pasas serviceAccountKey, intenta usar ADC (gcloud auth application-default login)

const admin = require('firebase-admin');
const fs = require('fs');

const uid = process.argv[2];
const keyPath = process.argv[3];

if(!uid){
  console.error('Uso: node set-admin-claim.js <UID> [path/to/serviceAccountKey.json]');
  process.exit(1);
}

if(keyPath){
  if(!fs.existsSync(keyPath)){
    console.error('No se encontró el archivo de credenciales:', keyPath);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
}else{
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

admin.auth().setCustomUserClaims(uid, { admin: true })
.then(() => {
  console.log('Claim admin asignado al UID:', uid);
  process.exit(0);
})
.catch(err => {
  console.error('Error asignando claim:', err);
  process.exit(2);
});
