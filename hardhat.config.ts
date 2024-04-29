import { exec as _exec } from 'child_process'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import dotenv from 'dotenv'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig } from 'hardhat/config'
import { promisify } from 'util'
import '@nomicfoundation/hardhat-verify'

const exec = promisify(_exec)

// hardhat actions
import './tasks/accounts'
import './tasks/archive_scan'
import './tasks/save'
import './tasks/seed'

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenv.config({ debug: false })

let real_accounts = undefined
if (process.env.DEPLOYER_KEY) {
  real_accounts = [
    process.env.DEPLOYER_KEY,
    process.env.OWNER_KEY || process.env.DEPLOYER_KEY,
  ]
}

// circular dependency shared with actions
export const archivedDeploymentPath = './deployments/archive'

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 4,
      accounts: real_accounts,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 3,
      accounts: real_accounts,
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/OOlTK4Do5mu08YekmJxTUp6PYcqV0kSi`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 5,
      accounts: real_accounts,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 11155111,
      accounts: real_accounts,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      tags: ['legacy', 'use_root'],
      chainId: 1,
      accounts: real_accounts,
    },
    testnet: {
      url: `https://frequent-burned-field.bsc-testnet.quiknode.pro/b6668ac98f0f22c66219d165a11d9e92a0d66308/`,
      tags: ['legacy', 'use_root'],
      chainId: 97,
      gasPrice: 5000000000,
      saveDeployments: false,
      accounts: real_accounts,
    },
    blast: {
      url: 'https://lingering-indulgent-replica.blast-mainnet.quiknode.pro/6667a8f4be701cb6549b415d567bc706fb2f13a8/',
      tags: ['legacy', 'use_root'],
      chainId: 81457,

      saveDeployments: true,
      accounts: real_accounts,
    },
    blast_sepolia: {
      url: 'https://few-thrilling-pond.blast-sepolia.quiknode.pro/031eacfcf467208ba0bf10da7d7931e0e378637e/',
      tags: ['legacy', 'use_root'],
      chainId: 168587773,

      saveDeployments: true,
      accounts: real_accounts,
    },
  },
  etherscan: {
    apiKey: {
      blast: 'blast', // apiKey is not required, just set a placeholder
      goerli: 'AY5WESGQP8TRPQ6HDC3BSUCEYSBVC87558',
      blast_sepolia: 'blast_sepolia', // apiKey is not required, just set a placeholder
    },
    customChains: [
      {
        network: 'blast',
        chainId: 81457,
        urls: {
          apiURL:
            'https://api.routescan.io/v2/network/mainnet/evm/81457/etherscan',
          browserURL: 'https://81457.routescan.io',
        },
      },
      {
        network: 'blast_sepolia',
        chainId: 168587773,
        urls: {
          apiURL:
            'https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan',
          browserURL: 'https://testnet.blastscan.io',
        },
      },
    ],
  },
  mocha: {},
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1200,
          },
        },
      },
      // for DummyOldResolver contract
      {
        version: '0.4.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  abiExporter: {
    path: './build/contracts',
    runOnCompile: true,
    clear: true,
    flat: true,
    except: [
      'Controllable$',
      'INameWrapper$',
      'SHA1$',
      'Ownable$',
      'NameResolver$',
      'TestBytesUtils$',
      'legacy/*',
    ],
    spacing: 2,
    pretty: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 1,
    },
  },
  external: {
    contracts: [
      {
        artifacts: [archivedDeploymentPath],
      },
    ],
  },
}

export default config
