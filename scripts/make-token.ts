import 'dotenv/config'
import { SignJWT } from 'jose'

async function main() {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!)
  const token = await new SignJWT({ id: 1, name: '이현', email: 'warehouse@demo.kr', role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
  console.log(token)
}
main()
