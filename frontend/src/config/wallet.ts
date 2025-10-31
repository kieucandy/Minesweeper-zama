import { createAppKit } from '@reown/appkit/react'
import { sepolia } from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

const projectId = 'd43bccd656d6c1a2f7c7693caab78e2c'

const metadata = {
  name: 'Minesweeper',
  description: 'Minesweeper',
  url: 'https://minesweeper-zama.vercel.app/',
  icons: ['https://minesweeper-zama.vercel.app/logo.png']
}

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  metadata,
  projectId,
  features: {
    analytics: false, 
    email: false,     
    socials: false,  
    onramp: false 
  }
})
