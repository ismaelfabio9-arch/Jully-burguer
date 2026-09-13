import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuração do projeto Firebase da JULLY BURGUER (novo, separado do
// projeto antigo "espetinho-do-nem"). Os valores vêm de variáveis de
// ambiente — veja o arquivo .env.example na raiz do projeto para saber
// onde pegar cada um deles no Firebase Console.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Blindado: se o Storage não estiver ativado no console do Firebase
// ainda, isso NÃO pode derrubar o app inteiro (mesas, produtos, etc.
// dependem só do Firestore acima, que já foi inicializado com sucesso).
export let storage = null;
try {
  storage = getStorage(app);
} catch (erro) {
  console.error("Storage não disponível ainda:", erro);
}
