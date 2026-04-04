import webPush from 'web-push'

const keys = webPush.generateVAPIDKeys()

console.log('=== VAPID Keys Generated ===')
console.log('')
console.log('Add to push-gateway/.env:')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_SUBJECT=mailto:admin@corp-matrix.local`)
console.log('')
console.log('Add to frontend .env:')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VITE_PUSH_GATEWAY_URL=http://localhost:3001`)
