/*
    Copyright 2018 The caver-js Authors
    This file is part of the caver-js library.
 
    The caver-js library is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
 
    The caver-js library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Lesser General Public License for more details.
 
    You should have received a copy of the GNU Lesser General Public License
    along with the caver-js. If not, see <http://www.gnu.org/licenses/>.
*/

const testRPCURL = require('../testrpc')
const { expect } = require('../extendedChai')

const setting = require('./setting')
const utils = require('./utils')
const Caver = require('../../index.js')
const BN = require('bn.js')

const MessagePrefix = "\x19Klaytn Signed Message:\n"

let caver

beforeEach(() => {
  caver = new Caver(testRPCURL)
})

function isAccount(data, { keys, address } = {}) {
  // account object keys
  const objectKeys = [
    'address',
    'accountKey',
    'privateKey',
    'signTransaction',
    'sign',
    'encrypt',
    'getKlaytnWalletKey'
  ]

  expect(Object.getOwnPropertyNames(data)).to.deep.equal(objectKeys)

  expect(caver.utils.isAddress(data.address)).to.equal(true)

  if (keys !== undefined) {
    compareAccountKey(data.accountKey, keys)
  }

  if (address !== undefined) {
    expect(data.address.toLowerCase()).to.equal(address.toLowerCase())
  }
}

function checkHashMessage(hashed, originMessage) {
  const enveloped = MessagePrefix + originMessage.length + originMessage
  const originHashed = caver.utils.sha3(enveloped)
  expect(hashed).to.equal(originHashed)
}

function isKeystoreV4(data, { address }) {
  const objectKeys = ['version', 'id', 'address', 'keyRing']
  expect(Object.getOwnPropertyNames(data)).to.deep.equal(objectKeys)

  expect(data.version).to.equals(4)

  expect(caver.utils.isAddress(data.address)).to.equal(true)

  prefixTrimmed = data.address.replace(/^(0x)*/i, '')
  expect(prefixTrimmed).to.match(new RegExp(`^${address.slice(2)}$`, 'i'))
}

function isWallet(data, { accounts } = {}) {
  // check if function exists
  const fns = ['add', 'remove', 'clear']
  fns.forEach(fn => {
    expect(fn in data).to.equal(true)
  })

  expect(data.defaultKeyName).to.equal('caverjs_wallet')

  if (accounts && accounts.length > 0) {
    expect(data.length).to.equal(accounts.length)

    for (let i = 0; i < data.length; i++) {
        let accountObj = caver.klay.accounts.createWithAccountKey(data[i].address, data[i].accountKey)

        isAccount(accountObj, { keys: accounts[i].keys, address: accounts[i].address })

        accountObj = caver.klay.accounts.createWithAccountKey(data[i].address, data[accountObj.address].accountKey)

        isAccount(accountObj, { keys: accounts[i].keys, address: accounts[i].address })
    }
  }
}

function compareAccountKey(keyFromAccount, key) {
  if (!keyFromAccount && !key) return

  if (typeof keyFromAccount.keys === 'string') {
    expect(isSameKeyString(keyFromAccount.keys, key)).to.be.true
    expect(isSameKeyString(keyFromAccount.transactionKey, key)).to.be.true
    expect(isSameKeyString(keyFromAccount.updateKey, key)).to.be.true
    expect(isSameKeyString(keyFromAccount.feePayerKey, key)).to.be.true
  } else if (Array.isArray(keyFromAccount.keys)) {
    expect(isSameKeyArray(keyFromAccount.keys, key)).to.be.true
    expect(isSameKeyArray(keyFromAccount.transactionKey, key)).to.be.true
    expect(isSameKeyArray(keyFromAccount.updateKey, key)).to.be.true
    expect(isSameKeyArray(keyFromAccount.feePayerKey, key)).to.be.true
  } else {
    expect(isSameKeyObject(keyFromAccount.keys, key)).to.be.true
    compareAccountKey(keyFromAccount._transactionKey, key.transactionKey)
    compareAccountKey(keyFromAccount._updateKey, key.updateKey)
    compareAccountKey(keyFromAccount._feePayerKey, key.feePayerKey)
  }
}

function isSameKeyString(str1, str2) {
  return str1.toLowerCase() === str2.toLowerCase()
}

function isSameKeyArray(arr1, arr2) {
  if (arr1.length !== arr2.length) return false
  for (let i = 0; i < arr1.length; i ++) {
    if (arr1[i].toLowerCase() !== arr2[i].toLowerCase()) return false
  }
  return true
}

function isSameKeyObject(obj1, obj2) {
  const keys = Object.keys(obj1)
  keys.map((r)=> {
    if (typeof obj1[r] === 'string' && !isSameKeyString(obj1[r], obj2[r])) return false
    if (Array.isArray(obj1[r]) && !isSameKeyArray(obj1[r], obj2[r])) return false
  })
  return true
}

describe('caver.klay.accounts.create', () => {
  context('CAVERJS-UNIT-WALLET-021 : input: no parameter', () => {
    it('should return valid account', () => {
      const result = caver.klay.accounts.create()
      return isAccount(result)
    })
  })

  context('CAVERJS-UNIT-WALLET-022 : input: entropy', () => {
    it('should return valid account', () => {
      const entropy = caver.utils.randomHex(32)

      const result = caver.klay.accounts.create(entropy)
      return isAccount(result)
    })
  })
})

describe('caver.klay.accounts.privateKeyToAccount', () => {
  context('input: valid privatekey', () => {
    it('should return valid account', () => {
      const privateKey = caver.utils.randomHex(32)
      const result = caver.klay.accounts.privateKeyToAccount(privateKey)
      return isAccount(result)
    })
  })

  context('input: invalid privatekey', () => {
    it('should throw an error', () => {
      const invalidPrivateKey = caver.utils.randomHex(31)

      const errorMessage = 'Invalid private key'
      expect(() => caver.klay.accounts.privateKeyToAccount(invalidPrivateKey))
        .to.throw(errorMessage)
    })
  })
})

describe('caver.klay.accounts.signTransaction', () => {
  let txObj, vtTx, account

  beforeEach(() => {
    account = caver.klay.accounts.create()
    caver.klay.accounts.wallet.add(account)
    feePayer = caver.klay.accounts.wallet.add('0x3bdc858e890c3c845ea9ca24b1e9ed183a56eb78d4bf5463da219a74f708eff6')
    sender = caver.klay.accounts.wallet.add('0x66de1a1fa104b008c3c34c1695415d71435384f3b68df03dda82e74f9d85064d')

    txObj = {
      from: account.address,
      nonce: '0x0',
      to: setting.toAddress,
      gas: setting.gas,
      gasPrice: setting.gasPrice,
      value: '0x1',
      chainId: 2019,
    }


    vtTx = { 
      type: 'VALUE_TRANSFER',
      from: account.address,
      to: '0xd05c5926b0a2f31aadcc9a9cbd3868a50104d834',
      value: '0x1',
      gas: '0xdbba0',
      chainId: '0x7e3',
      gasPrice: '0x5d21dba00',
      nonce: '0x9a',
    }
  })

  context('CAVERJS-UNIT-WALLET-023 : input: tx, privateKey', () => {
    it('should return signature and rawTransaction', async () => {
      const result = await caver.klay.accounts.signTransaction(
        txObj,
        account.privateKey
      )

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-026 : input: tx, privateKey, without nonce', () => {
    it('should return signature and rawTransaction', async () => {
      const tx = Object.assign({}, txObj)
      delete tx.nonce

      const result = await caver.klay.accounts.signTransaction(tx, account.privateKey)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-027 : input: tx, privateKey, without gasPrice', () => {
    it('should return signature and rawTransaction', async () => {
      const tx = Object.assign({}, txObj)
      delete tx.gasPrice

      const result = await caver.klay.accounts.signTransaction(tx, account.privateKey)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-028 : input: tx, privateKey, without chainId', () => {
    it('should return signature and rawTransaction', async () => {
      const tx = Object.assign({}, txObj)
      delete tx.chainId

      const result = await caver.klay.accounts.signTransaction(tx, account.privateKey)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-024 : input: tx:invalid address, privateKey', () => {
    it('should throw an error', async () => {
      const invalid = Object.assign({}, txObj)
      delete invalid.to
      delete invalid.data

      const errorMessage = 'contract creation without any data provided'

      await expect(caver.klay.accounts.signTransaction(invalid, account.privateKey))
        .to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-024 : input: tx:invalid value, privateKey', async () => {
    it('should throw an error', async () => {
      const invalid = Object.assign({}, txObj)
      invalid.value = '0xzzzz'

      const errorMessage = `Given input "${invalid.value}" is not a number.`

      await expect(caver.klay.accounts.signTransaction(invalid, account.privateKey))
        .to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-025 : input: tx, privateKey:invalid', () => {
    it('should throw an error', async () => {
      const invalidPrivateKey = caver.utils.randomHex(31)    // 31bytes

      const errorMessage = 'Invalid private key'

      await expect(caver.klay.accounts.signTransaction(txObj, invalidPrivateKey)).to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-023 : input: tx, privateKey, callback', () => {
    it('should return signature and rawTransaction', (done) => {
      caver.klay.accounts.signTransaction(
        txObj,
        account.privateKey,
        (error, result) => {
          const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
          expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

          expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
          done()
        })
    })
  })

  context('CAVERJS-UNIT-WALLET-102 : input: tx, privateKey, callback', () => {
    it('should return valid senderTxHash', async () => {
      const feeDelegatedTx = { 
        type: 'FEE_DELEGATED_VALUE_TRANSFER',
        from: '0x76d1cc1cdb081de8627cab2c074f02ebc7bce0d0',
        to: '0xd05c5926b0a2f31aadcc9a9cbd3868a50104d834',
        value: '0x1',
        gas: '0xdbba0',
        chainId: '0x7e3',
        gasPrice: '0x5d21dba00',
        nonce: '0x9a',
      }
      const result = await caver.klay.accounts.signTransaction(feeDelegatedTx, '1881a973628dba6ab07b6b47c8f3fb50d8e7cbf71fef3b4739155619a3c126fa')
      expect(result.senderTxHash).to.equal('0x1b7c0f2fc7548056e90d9690e8c397acf99eb38e622ac91ee22c2085065f8a55')
    })
  })

  context('CAVERJS-UNIT-WALLET-122 : input: legacyTx, privateKey of decoupled account', () => {
    it('should return signature and rawTransaction', async () => {
      const decoupledAccount = caver.klay.accounts.privateKeyToAccount(caver.klay.accounts.create().privateKey, caver.klay.accounts.create().address)

      let tx = {
        from: decoupledAccount.address,
        nonce: '0x0',
        to: setting.toAddress,
        gas: setting.gas,
        gasPrice: setting.gasPrice,
        value: '0x1',
        chainId: 2019,
      }

      const errorMessage = 'A legacy transaction must be with a legacy account key'

      await expect(caver.klay.accounts.signTransaction(tx, decoupledAccount.privateKey)).to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-123 : input: if there are invalid number of parameters then signTrasnaction should reject', () => {
    it('should reject when there is no parameter', async () => {
      const errorMessage = 'Invalid parameter: The number of parameters is invalid.'
      await expect(caver.klay.accounts.signTransaction()).to.be.rejectedWith(errorMessage)
    })

    it('should reject when there are more than three parameters', async () => {
      const errorMessage = 'Invalid parameter: The number of parameters is invalid.'
      await expect(caver.klay.accounts.signTransaction({}, 'privateKey', ()=>{}, 'one more')).to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-124 : input: if there are valid number of parameters then signTrasnaction should set properly', () => {
    it('should sign to transaction parameter with private key in wallet', async () => {
      const result = await caver.klay.accounts.signTransaction(txObj)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(typeof result.signatures[0]).to.equals('string')

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)
    })

    it('should sign to transaction parameter with private key in wallet with callback', async () => {
      let isCalled = false
      const result = await caver.klay.accounts.signTransaction(txObj, (error, result) => isCalled = true)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(typeof result.signatures[0]).to.equals('string')

      expect(caver.klay.accounts.recoverTransaction(result.rawTransaction)).to.equal(account.address)

      expect(isCalled).to.be.true
    })

    it('should sign to transaction parameter with private key parameter', async () => {
      const result = await caver.klay.accounts.signTransaction(vtTx, account.privateKey)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(Array.isArray(result.signatures[0])).to.be.true
      expect(result.signatures.length).to.equals(1)
    })

    it('should sign to transaction parameter with private key array', async () => {
      const privateKeyArray = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const result = await caver.klay.accounts.signTransaction(vtTx, privateKeyArray)

      const keys = ['messageHash', 'v', 'r', 's', 'rawTransaction', 'txHash', 'senderTxHash', 'signatures']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      expect(Array.isArray(result.signatures[0])).to.be.true
      expect(result.signatures.length).to.equals(2)

      const decoded = caver.klay.decodeTransaction(result.rawTransaction)
      expect(decoded.signatures.length).to.equals(2)
      expect(decoded.signatures[0][0]).to.equals(result.signatures[0][0])
      expect(decoded.signatures[0][1]).to.equals(result.signatures[0][1])
      expect(decoded.signatures[0][2]).to.equals(result.signatures[0][2])
      expect(decoded.signatures[1][0]).to.equals(result.signatures[1][0])
      expect(decoded.signatures[1][1]).to.equals(result.signatures[1][1])
      expect(decoded.signatures[1][2]).to.equals(result.signatures[1][2])
    })
  })

  context('CAVERJS-UNIT-WALLET-130 : input: txObject', () => {
    it('should sign with feePayer and return feePayerSignatures', async () => {
      const feeDelegatedTx = { 
        type: 'FEE_DELEGATED_VALUE_TRANSFER',
        from: '0x76d1cc1cdb081de8627cab2c074f02ebc7bce0d0',
        to: '0xd05c5926b0a2f31aadcc9a9cbd3868a50104d834',
        value: '0x1',
        gas: '0xdbba0',
        chainId: '0x7e3',
        gasPrice: '0x5d21dba00',
        nonce: '0x9a',
      }
      const senderSigned = await caver.klay.accounts.signTransaction(feeDelegatedTx, '1881a973628dba6ab07b6b47c8f3fb50d8e7cbf71fef3b4739155619a3c126fa')
      
      const feePayerTransaction = {
        senderRawTransaction: senderSigned.rawTransaction,
        feePayer: account.address
      }
      const feePayerSigned = await caver.klay.accounts.signTransaction(feePayerTransaction)
      expect(feePayerSigned.feePayerSignatures).not.to.be.undefined
      expect(Array.isArray(feePayerSigned.feePayerSignatures)).to.be.true

      const decoded = caver.klay.decodeTransaction(feePayerSigned.rawTransaction)
      expect(decoded.signatures.length).to.equals(1)
      expect(decoded.signatures[0][0]).to.equals(senderSigned.signatures[0][0])
      expect(decoded.signatures[0][1]).to.equals(senderSigned.signatures[0][1])
      expect(decoded.signatures[0][2]).to.equals(senderSigned.signatures[0][2])
      expect(decoded.feePayerSignatures[0][0]).to.equals(feePayerSigned.feePayerSignatures[0][0])
      expect(decoded.feePayerSignatures[0][1]).to.equals(feePayerSigned.feePayerSignatures[0][1])
      expect(decoded.feePayerSignatures[0][2]).to.equals(feePayerSigned.feePayerSignatures[0][2])
    })
  })

  context('CAVERJS-UNIT-WALLET-131 : input: txObject for fee payer without feePayer field', () => {
    it('should reject', async () => {
      const feeDelegatedTx = { 
        type: 'FEE_DELEGATED_VALUE_TRANSFER',
        from: '0x76d1cc1cdb081de8627cab2c074f02ebc7bce0d0',
        to: '0xd05c5926b0a2f31aadcc9a9cbd3868a50104d834',
        value: '0x1',
        gas: '0xdbba0',
        chainId: '0x7e3',
        gasPrice: '0x5d21dba00',
        nonce: '0x9a',
      }
      const senderSigned = await caver.klay.accounts.signTransaction(feeDelegatedTx, '1881a973628dba6ab07b6b47c8f3fb50d8e7cbf71fef3b4739155619a3c126fa')
      
      const feePayerTransaction = {
        senderRawTransaction: senderSigned.rawTransaction,
      }

      const errorMessage = `Invalid fee payer: ${feePayerTransaction.feePayer}`
      await expect(caver.klay.accounts.signTransaction(feePayerTransaction)).to.be.rejectedWith(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-132 : input: txObject without private key', () => {
    it('when fail to find account, should reject with expected error message', async () => {
      const feeDelegatedTx = { 
        type: 'FEE_DELEGATED_VALUE_TRANSFER',
        from: caver.klay.accounts.create().address,
        to: '0xd05c5926b0a2f31aadcc9a9cbd3868a50104d834',
        value: '0x1',
        gas: '0xdbba0',
        chainId: '0x7e3',
        gasPrice: '0x5d21dba00',
        nonce: '0x9a',
      }
      const errorMessage = 'Failed to find get private key to sign. The account you want to use for signing must exist in caver.klay.accounts.wallet or you must pass the private key as a parameter.'
      await expect(caver.klay.accounts.signTransaction(feeDelegatedTx)).to.be.rejectedWith(errorMessage)
    })
  })
})

describe('caver.klay.accounts.recoverTransaction', () => {
  let account
  let rawTx

  beforeEach(async () => {
    account = caver.klay.accounts.create()

    const txObj = {
      from: account.address,
      nonce: '0x0',
      to: setting.toAddress,
      gas: setting.gas,
      gasPrice: setting.gasPrice,
      value: '0x1'
    }
    const signedTx = await account.signTransaction(txObj)
    rawTx = signedTx.rawTransaction
  })

  context('CAVERJS-UNIT-WALLET-029 : rawTransaction', () => {
    it('should return valid address', () => {
      const result = caver.klay.accounts.recoverTransaction(rawTx)
      expect(result).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-030 : rawTransaction:invalid', () => {
    it('should not equal to account.address', () => {
      const invalid = rawTx.slice(0, -2)
      const result = caver.klay.accounts.recoverTransaction(invalid)
      expect(result).to.not.equal(account.addrss)
    })
  })

  context('CAVERJS-UNIT-WALLET-104 : rawTransaction: leading zeroes of the signature are trimmed', () => {
    it('should equal to account.address', async () => {
      const transaction = {
        from: '0x13b0d8316F0c3cE0C3C51Ebb586A14d7d90112fD',
        nonce: '0x0',
        to: '0x30d8d4217145ba3f6cde24ec28c64c9120f2bdfb',
        gas: 900000,
        gasPrice: 25000000000,
        value: '0x1',
        chainId: 10000,
      }

      let privateKey = '0x72d72a46401220f08ccb1b17b550feb816840f2f8ce86361e7ee54ac7a9ee6d8'
      account = caver.klay.accounts.privateKeyToAccount(privateKey)

      const signed = await caver.klay.accounts.signTransaction(transaction, account.privateKey)

      const rlpDecoded = caver.utils.rlpDecode(signed.rawTransaction)
      expect(rlpDecoded[7].length).not.to.equals(rlpDecoded[8].length)

      const result = caver.klay.accounts.recoverTransaction(signed.rawTransaction)
      expect(result).to.not.equal(account.addrss)
    })
  })

  context('CAVERJS-UNIT-WALLET-105 : rawTransaction: Non-LEGACY transactions.', () => {
    it('should throw error', async () => {
      const transaction = {
        type: 'VALUE_TRANSFER',
        from: '0x13b0d8316F0c3cE0C3C51Ebb586A14d7d90112fD',
        nonce: '0x0',
        to: '0x30d8d4217145ba3f6cde24ec28c64c9120f2bdfb',
        gas: 900000,
        gasPrice: 25000000000,
        value: '0x1',
        chainId: 10000,
      }
      address = '0x13b0d8316F0c3cE0C3C51Ebb586A14d7d90112fD'
      privateKey = '0x72d72a46401220f08ccb1b17b550feb816840f2f8ce86361e7ee54ac7a9ee6d8'
      caver.klay.accounts.privateKeyToAccount(privateKey, address)

      const signed = await caver.klay.accounts.signTransaction(transaction, account.privateKey)

      const errorMessage = 'recoverTransaction only supports transactions of type "LEGACY".'
      expect(()=>caver.klay.accounts.recoverTransaction(signed.rawTransaction)).to.throws(errorMessage)
    })
  })
})

describe('caver.klay.accounts.hashMessage', () => {
  it('CAVERJS-UNIT-WALLET-031, CAVERJS-UNIT-WALLET-032 : result should be same with keccak256(MessagePrefix + originMessage.length + originMessage)', () => {
    const message = 'Hello World'
    let result = caver.klay.accounts.hashMessage(message)
    checkHashMessage(result, message)

    const decoded = caver.utils.utf8ToHex(message)
    result = caver.klay.accounts.hashMessage(decoded)
    checkHashMessage(result, message)
  })
})

describe('caver.klay.accounts.sign', () => {
  let account

  beforeEach(() => {
    account = caver.klay.accounts.create()
  })

  context('CAVERJS-UNIT-WALLET-033 : input: data, privateKey', () => {
    it('should recover valid address', () => {
      const data = 'Some data'
      let result = caver.klay.accounts.sign(data, account.privateKey)

      const keys = ['message', 'messageHash', 'v', 'r', 's', 'signature']
      expect(Object.getOwnPropertyNames(result)).to.deep.equal(keys)

      if (data != result.message) {
        expect(data).to.equal(caver.utils.utf8ToHex(result.message))
      }

      const decoded = caver.utils.utf8ToHex(data)
      result = caver.klay.accounts.sign(decoded, account.privateKey)
      checkHashMessage(result.messageHash, data)

      expect(caver.klay.accounts.recover(result)).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-034 : input: data, privateKey:invalid', () => {
    it('should throw an error', () => {
      const data = 'Some data'
      const invalid = caver.utils.randomHex(31)    // 31bytes

      const errorMessage = 'Invalid private key'
      expect(() => caver.klay.accounts.sign(data, invalid)).to.throw(errorMessage)
    })
  })
})

// caver.klay.accounts.recover
describe('caver.klay.accounts.recover', () => {
  let account

  beforeEach(() => {
    account = caver.klay.accounts.create()
  })

  context('CAVERJS-UNIT-WALLET-035 : input: signatureObject', () => {
    it('result should be same with account.address', () => {
      const message = 'Some data'
      const sigObj = account.sign(message)

      let result = caver.klay.accounts.recover(sigObj)
      expect(result).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-036 : input: message, signature', () => {
    it('result should be same with account.address', () => {
      const message = 'Some data'
      const sigObj = account.sign(message)

      let result = caver.klay.accounts.recover(sigObj.message, sigObj.signature)
      expect(result).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-037 : input: message, signature, prefixed', () => {
    it('result should be same with account.address', () => {
      const message = 'Some data'
      const sigObj = account.sign(message)
      const prefixed = true

      const messageHash = caver.klay.accounts.hashMessage(message)

      let result = caver.klay.accounts.recover(messageHash, sigObj.signature, prefixed)
      expect(result).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-038 : input: message, v, r, s', () => {
    it('result should be same with account.address', () => {
      const message = 'Some data'
      const sigObj = account.sign(message)

      let result = caver.klay.accounts.recover(sigObj.message, sigObj.v, sigObj.r, sigObj.s)
      expect(result).to.equal(account.address)
    })
  })

  context('CAVERJS-UNIT-WALLET-039 : input: message, v, r, s, prefixed', () => {
    it('result should be same with account.address', () => {
      const message = 'Some data'
      const sigObj = account.sign(message)
      const prefixed = true

      const messageHash = caver.klay.accounts.hashMessage(message)

      let result = caver.klay.accounts.recover(messageHash, sigObj.v, sigObj.r, sigObj.s, prefixed)
      expect(result).to.equal(account.address)
    })
  })
})

// caver.klay.accounts.encrypt
describe('caver.klay.accounts.encrypt', () => {
  let account

  beforeEach(() => {
    account = caver.klay.accounts.create()
  })

  context('CAVERJS-UNIT-WALLET-040 : input: privateKey, password', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let result = caver.klay.accounts.encrypt(account.privateKey, password)

      isKeystoreV4(result, account)

      const decryptedAccount = caver.klay.accounts.decrypt(result, password)
      isAccount(decryptedAccount, {keys: account.keys, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-041 : input: privateKey:invalid, password', () => {
    it('should throw an error', () => {
      const invalid = caver.utils.randomHex(31)    // 31bytes
      const password = 'klaytn!@'

      const errorMessage = 'Invalid private key'
      expect(() => caver.klay.accounts.encrypt(invalid, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-096 : input: privateKey:KlaytnWalletKey, password', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let result = caver.klay.accounts.encrypt(account.getKlaytnWalletKey(), password)

      isKeystoreV4(result, account)

      const decryptedAccount = caver.klay.accounts.decrypt(result, password)
      isAccount(decryptedAccount, {keys: account.keys, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-097 : input: privateKey:KlaytnWalletKey, password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let result = caver.klay.accounts.encrypt(account.getKlaytnWalletKey(), password, {address: account.address})

      isKeystoreV4(result, account)

      const decryptedAccount = caver.klay.accounts.decrypt(result, password)
      isAccount(decryptedAccount, {keys: account.keys, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-098 : input: privateKey:KlaytnWalletKey, password, {address:invalid}', () => {
    it('should throw an error', () => {
      const password = 'klaytn!@'

      const errorMessage = 'The address extracted from the private key does not match the address received as the input value.'
      expect(() => caver.klay.accounts.encrypt(account.getKlaytnWalletKey(), password, {address: caver.klay.accounts.create().address})).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-099 : input: privateKey:KlaytnWalletKey(decoupled), password', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, caver.klay.accounts.create().privateKey)

      let result = caver.klay.accounts.encrypt(testAccount.getKlaytnWalletKey(), password)

      isKeystoreV4(result, testAccount)

      const decryptedAccount = caver.klay.accounts.decrypt(result, password)
      isAccount(decryptedAccount, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-100 : input: privateKey:KlaytnWalletKey(decoupled), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'
      
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, caver.klay.accounts.create().privateKey)

      let result = caver.klay.accounts.encrypt(testAccount.getKlaytnWalletKey(), password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)

      const decryptedAccount = caver.klay.accounts.decrypt(result, password)
      isAccount(decryptedAccount, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-101 : input: privateKey:KlaytnWalletKey(decoupled), password, {address:invalid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, caver.klay.accounts.create().privateKey)

      const errorMessage = 'The address extracted from the private key does not match the address received as the input value.'
      expect(() => caver.klay.accounts.encrypt(testAccount.getKlaytnWalletKey(), password, {address: caver.klay.accounts.create().address})).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-351: input: array of private key string, password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(key.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-352: input: array of private key string, password', () => {
    it('should throw error when address is not defined', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      const errorMessage = 'The address must be defined inside the options object.'
      expect(() => caver.klay.accounts.encrypt(testAccount.keys, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-353: input: key object(transactionKey, updateKey and feePayerKey are defined), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(3)
      expect(result.keyRing[0].length).to.equals(1)
      expect(result.keyRing[1].length).to.equals(1)
      expect(result.keyRing[2].length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-354: input: key object(transactionKey, updateKey and feePayerKey are defined with array of private key), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(3)
      expect(result.keyRing[0].length).to.equals(key.transactionKey.length)
      expect(result.keyRing[1].length).to.equals(key.updateKey.length)
      expect(result.keyRing[2].length).to.equals(key.feePayerKey.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-355: input: key object(transactionKey is defined), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(1)
      expect(result.keyRing[0].length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-356: input: key object(updateKey is defined), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = {
        updateKey: caver.klay.accounts.create().privateKey,
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(2)
      expect(result.keyRing[0].length).to.equals(0)
      expect(result.keyRing[1].length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-357: input: key object(feePayerKey is defined), password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = {
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      let result = caver.klay.accounts.encrypt(testAccount.keys, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(3)
      expect(result.keyRing[0].length).to.equals(0)
      expect(result.keyRing[1].length).to.equals(0)
      expect(result.keyRing[2].length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-358: input: key object, password', () => {
    it('should throw error when address is not defined', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, key)

      const errorMessage = 'The address must be defined inside the options object.'
      expect(() => caver.klay.accounts.encrypt(testAccount.keys, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-359: input: AccountKeyPublic, password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = caver.klay.accounts.create().privateKey
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(accountKey, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-360: input: AccountKeyPublic, password', () => {
    it('should throw error', () => {
      const password = 'klaytn!@'

      let key = caver.klay.accounts.create().privateKey
      let accountKey = caver.klay.accounts.createAccountKey(key)

      const errorMessage = 'The address must be defined inside the options object.'
      expect(() => caver.klay.accounts.encrypt(accountKey, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-361: input: AccountKeyMultiSig, password, {address:valid}', () => {
    it('should encrypt key with password', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(accountKey, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(key.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-362: input: AccountKeyMultiSig, password', () => {
    it('should throw error', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let accountKey = caver.klay.accounts.createAccountKey(key)

      const errorMessage = 'The address must be defined inside the options object.'
      expect(() => caver.klay.accounts.encrypt(accountKey, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-363: input: AccountKeyRoleBased, password, {address:valid}', () => {
    it('should encrypt key with password', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(accountKey, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(3)
      expect(result.keyRing[0].length).to.equals(1)
      expect(result.keyRing[1].length).to.equals(key.updateKey.length)
      expect(result.keyRing[2].length).to.equals(key.feePayerKey.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-364: input: AccountKeyMultiSig, password', () => {
    it('should throw error', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      let accountKey = caver.klay.accounts.createAccountKey(key)

      const errorMessage = 'The address must be defined inside the options object.'
      expect(() => caver.klay.accounts.encrypt(accountKey, password)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-365: input: Account with AccountKeyPublic, password, {address:valid}', () => {
    it('should encrypt password with privateKey', () => {
      const password = 'klaytn!@'

      let key = caver.klay.accounts.create().privateKey
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(testAccount, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(1)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-366: input: Account with AccountKeyPublic, password, {address:different address}', () => {
    it('should throw error when addresses are not matched', () => {
      const password = 'klaytn!@'

      let key = caver.klay.accounts.create().privateKey
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      const errorMessage = 'Address in account is not matched with address in options object'
      expect(() => caver.klay.accounts.encrypt(testAccount, password, {address: caver.klay.accounts.create().address})).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-367: input: Account with AccountKeyMultiSig, password, {address:valid}', () => {
    it('should encrypt key with password', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(accountKey, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(key.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-368: input: Account with AccountKeyMultiSig, password, {address:different address}', () => {
    it('should throw error when addresses are not matched', () => {
      const password = 'klaytn!@'

      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      const errorMessage = 'Address in account is not matched with address in options object'
      expect(() => caver.klay.accounts.encrypt(testAccount, password, {address: caver.klay.accounts.create().address})).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-369: input: Account with AccountKeyRoleBased, password, {address:valid}', () => {
    it('should encrypt key with password', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      let result = caver.klay.accounts.encrypt(accountKey, password, {address: testAccount.address})

      isKeystoreV4(result, testAccount)
      expect(result.keyRing.length).to.equals(3)
      expect(result.keyRing[0].length).to.equals(1)
      expect(result.keyRing[1].length).to.equals(key.updateKey.length)
      expect(result.keyRing[2].length).to.equals(key.feePayerKey.length)

      const decrypted = caver.klay.accounts.decrypt(result, password)
      isAccount(decrypted, {keys: testAccount.keys, address: testAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-370: input: Account with AccountKeyRoleBased, password, {address:different address}', () => {
    it('should throw error when addresses are not matched', () => {
      const password = 'klaytn!@'

      let key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      let accountKey = caver.klay.accounts.createAccountKey(key)
      let testAccount = caver.klay.accounts.createWithAccountKey(account.address, accountKey)

      const errorMessage = 'Address in account is not matched with address in options object'
      expect(() => caver.klay.accounts.encrypt(testAccount, password, {address: caver.klay.accounts.create().address})).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-385: input: Account with AccountKeyMultiSig, password, option', () => {
    it('should throw error when addresses are not matched', () => {
      const password = 'password'

      let testAccount = caver.klay.accounts.createWithAccountKey('0xf725a2950dc959638fa09f9d9b5426ad3dd8cd90', {
        transactionKey: '0x7dc66dca0e5d56940c99ad01903a8ba5fd9e1f7a51a8ab07cf81ccd1d3c4be16',
        updateKey: ['0x5fc3216454ab841ffa2bed0933a27bcdf2965238372bff3ec4fe56cbf5389a87', '0x79fe0616e7624314611b8e9c716b8d9c0c8c8c20f654021ff5fa7c46dc50709b'],
        feePayerKey: '0xfac188dc156ef58d529ea14ac95379f502a390d5720a9575b87545e36b3f758e',
      })
      
      let encryptOption = {
        salt: 'e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a',
        iv: Buffer.from('38aa896fc128075425e512f01e4b206c', 'hex'),
        kdf: 'scrypt',
        dklen: 32,
        n: 4096,
        r: 8,
        p: 1,
        cipher: 'aes-128-ctr',
        uuid: Buffer.from('e7c4605ad8200e0d93cd67f9d82fb997', 'hex'),
      }

      const expectedKeystore = { 
        version: 4,
        id: 'e7c4605a-d820-4e0d-93cd-67f9d82fb997',
        address: '0xf725a2950dc959638fa09f9d9b5426ad3dd8cd90',
        keyRing:[ 
          [ 
            { 
              ciphertext: '5e2f95f61d7af3bebf4ff9f5d5813690c80b0b5aaebd6e8b22d0f928ff06776a',
              cipherparams: { iv: '38aa896fc128075425e512f01e4b206c' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: 'e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a',
                n: 4096,
                r: 8,
                p: 1 
              },
             mac: 'fb86255428e24ba701201d5815f2f2114214cbd34fe4bc7a24b948a8ceac9f9b' 
            }
          ],
          [ 
            { 
              ciphertext: '7c2ad958478c213549fdb9fd7619c6f8c7034618c83e3ab229af6332d9fa53fb',
              cipherparams: { iv: '38aa896fc128075425e512f01e4b206c' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: 'e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: 'e6c3897772916c69f7c778ac2e0e60b786c55f17367c68b086486bd68fea9517' 
            },
            { 
              ciphertext: '5a17fe2af445e63ed2cdda6834d030a9391998000941c79318ab49bff092b9e7',
              cipherparams: { iv: '38aa896fc128075425e512f01e4b206c' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: 'e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: '633f91994f33541fbf1c3c3e973e539c12f1dd98f2757f64e3b63de986f367e0'
            }
          ],
          [ 
            { 
              ciphertext: 'd92870e0064950a7e148f5be8ce8c4c0373684f58d1f50f95524701a47fdbcf2',
              cipherparams: { iv: '38aa896fc128075425e512f01e4b206c' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: 'e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: 'b2f0245036e7bbdea712819dfbe019c8bfb237684c67d61fa82638868a7ae752' 
            }
          ] 
        ],
      }

      let result = caver.klay.accounts.encrypt(testAccount, password, encryptOption)
      
      expect(result.version).to.equals(expectedKeystore.version)
      expect(result.id).to.equals(expectedKeystore.id)
      expect(result.address).to.equals(expectedKeystore.address)
      compareEncrypted(result.keyRing[0][0], expectedKeystore.keyRing[0][0])
      compareEncrypted(result.keyRing[1][0], expectedKeystore.keyRing[1][0])
      compareEncrypted(result.keyRing[1][1], expectedKeystore.keyRing[1][1])
      compareEncrypted(result.keyRing[2][0], expectedKeystore.keyRing[2][0])

      function compareEncrypted(ret, exp) {
        expect(ret.ciphertext).to.equals(exp.ciphertext)
        expect(ret.cipherparams.iv).to.equals(exp.cipherparams.iv)
        expect(ret.cipher).to.equals(exp.cipher)
        expect(ret.kdf).to.equals(exp.kdf)
        expect(ret.kdfparams.dklen).to.equals(exp.kdfparams.dklen)
        expect(ret.kdfparams.salt).to.equals(exp.kdfparams.salt)
        expect(ret.kdfparams.n).to.equals(exp.kdfparams.n)
        expect(ret.kdfparams.r).to.equals(exp.kdfparams.r)
        expect(ret.kdfparams.p).to.equals(exp.kdfparams.p)
        expect(ret.mac).to.equals(exp.mac)
      }

      isKeystoreV4(result, testAccount)
    })
  })
})

describe('caver.klay.accounts.decrypt', () => {
  let account

  beforeEach(() => {
    account = caver.klay.accounts.create()
  })

  context('CAVERJS-UNIT-WALLET-042 : input: keystoreJsonV4, password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const keystoreJsonV4 = caver.klay.accounts.encrypt(account.privateKey, password)

      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      isKeystoreV4(keystoreJsonV4, result)

      isAccount(result, {keys: account.keys, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-103 : input: keystoreJsonV4(without 0x address format), password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const keystoreJsonV4 = caver.klay.accounts.encrypt(account.privateKey, password)
      keystoreJsonV4.address = keystoreJsonV4.address.replace('0x', '')
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      expect(result.address.slice(0, 2)).to.equals('0x')
    })
  })

  context('CAVERJS-UNIT-WALLET-371: input: keystoreJsonV4 that encrypts Account with AccountKeyMultiSig, password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const keystoreJsonV4 = caver.klay.accounts.encrypt(key, password, { address: account.address })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-372: input: keystoreJsonV4 that encrypts Account with AccountKeyRoleBased, password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const keystoreJsonV4 = caver.klay.accounts.encrypt(key, password, { address: account.address })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-373: input: keystoreJsonV4 that encrypts Account with AccountKeyRoleBased(transactionKey only), password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
      }
      const keystoreJsonV4 = caver.klay.accounts.encrypt(key, password, { address: account.address })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-374: input: keystoreJsonV4 that encrypts Account with AccountKeyRoleBased(updateKey only), password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = {
        updateKey: caver.klay.accounts.create().privateKey,
      }
      const keystoreJsonV4 = caver.klay.accounts.encrypt(key, password, { address: account.address })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-375: input: keystoreJsonV4 that encrypts Account with AccountKeyRoleBased(feePayerKey only), password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = {
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const keystoreJsonV4 = caver.klay.accounts.encrypt(key, password, { address: account.address })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })
  
  context('CAVERJS-UNIT-WALLET-378: input: keystoreJsonV4 that encrypts Account, password', () => {
    it('After decrypting, should return valid account', () => {
      const password = 'klaytn!@'
      const key = caver.klay.accounts.create().privateKey
      const keystore = caver.klay.accounts.encrypt(key, password, { address: account.address })
      keystore.version = 3
      keystore.crypto = keystore.keyRing[0]
      delete keystore.keyRing
      
      let result = caver.klay.accounts.decrypt(keystore, password)
      
      isAccount(result, {keys: key, address: account.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-379: input: keystoreJsonV4 that encrypts Account, password', () => {
    it('should throw error with invalid keystore v3 which not defines crypto', () => {
      const password = 'klaytn!@'
      const key = caver.klay.accounts.create().privateKey
      const keystore = caver.klay.accounts.encrypt(key, password, { address: account.address })
      keystore.version = 3
      
      const expectedError = `Invalid keystore V3 format: 'crypto' is not defined.`
      
      expect(() => caver.klay.accounts.decrypt(keystore, password)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-380: input: keystoreJsonV4 that encrypts Account, password', () => {
    it('should throw error with invalid keystore v3 which defines crypto and keyRing', () => {
      const password = 'klaytn!@'
      const key = caver.klay.accounts.create().privateKey
      const keystore = caver.klay.accounts.encrypt(key, password, { address: account.address })
      keystore.version = 3
      keystore.crypto = keystore.keyRing[0]
      
      const expectedError = `Invalid key store format: 'crypto' can not be with 'keyRing'`
      
      expect(() => caver.klay.accounts.decrypt(keystore, password)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-381: input: keystoreJsonV4 that encrypts Account, password', () => {
    it('should throw error with invalid keystore v3 which defines crypto and keyRing', () => {
      const password = 'klaytn!@'
      const key = caver.klay.accounts.create().privateKey
      const keystore = caver.klay.accounts.encrypt(key, password, { address: account.address })
      keystore.crypto = keystore.keyRing[0]
      
      const expectedError = `Invalid key store format: 'crypto' can not be with 'keyRing'`
      
      expect(() => caver.klay.accounts.decrypt(keystore, password)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-382: input: keystoreJsonV4 that encrypts Account, password', () => {
    it('should throw error with invalid length of key', () => {
      const password = 'klaytn!@'
      const key = caver.klay.accounts.create().privateKey
      const keystore = caver.klay.accounts.encrypt(key, password, { address: account.address })
      keystore.keyRing = [[], [], [], []]
      
      const expectedError = `Invalid key store format`
      
      expect(() => caver.klay.accounts.decrypt(keystore, password)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-383: input: hard coded keystoreJsonV4 that encrypts Account, password', () => {
    it('should decrypt and return valid account', () => {
      const keystoreJsonV4 = { 
        version: 4,
        id: '55da3f9c-6444-4fc1-abfa-f2eabfc57501',
        address: '0x86bce8c859f5f304aa30adb89f2f7b6ee5a0d6e2',
        keyRing:[ 
          [ 
            { 
              ciphertext: '93dd2c777abd9b80a0be8e1eb9739cbf27c127621a5d3f81e7779e47d3bb22f6',
              cipherparams: { iv: '84f90907f3f54f53d19cbd6ae1496b86' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: '69bf176a136c67a39d131912fb1e0ada4be0ed9f882448e1557b5c4233006e10',
                n: 4096,
                r: 8,
                p: 1 
              },
             mac: '8f6d1d234f4a87162cf3de0c7fb1d4a8421cd8f5a97b86b1a8e576ffc1eb52d2' 
            },
            { 
              ciphertext: '53d50b4e86b550b26919d9b8cea762cd3c637dfe4f2a0f18995d3401ead839a6',
              cipherparams: { iv: 'd7a6f63558996a9f99e7daabd289aa2c' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: '966116898d90c3e53ea09e4850a71e16df9533c1f9e1b2e1a9edec781e1ad44f',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: 'bca7125e17565c672a110ace9a25755847d42b81aa7df4bb8f5ce01ef7213295'
            }
          ],
          [ 
            { 
              ciphertext: 'f16def98a70bb2dae053f791882f3254c66d63416633b8d91c2848893e7876ce',
              cipherparams: { iv: 'f5006128a4c53bc02cada64d095c15cf' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: '0d8a2f71f79c4880e43ff0795f6841a24cb18838b3ca8ecaeb0cda72da9a72ce',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: '38b79276c3805b9d2ff5fbabf1b9d4ead295151b95401c1e54aed782502fc90a' 
            }
          ],
          [ 
            { 
              ciphertext: '544dbcc327942a6a52ad6a7d537e4459506afc700a6da4e8edebd62fb3dd55ee',
              cipherparams: { iv: '05dd5d25ad6426e026818b6fa9b25818' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: '3a9003c1527f65c772c54c6056a38b0048c2e2d58dc0e584a1d867f2039a25aa',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: '19a698b51409cc9ac22d63d329b1201af3c89a04a1faea3111eec4ca97f2e00f' 
            },
            { 
              ciphertext: 'dd6b920f02cbcf5998ed205f8867ddbd9b6b088add8dfe1774a9fda29ff3920b',
              cipherparams: { iv: 'ac04c0f4559dad80dc86c975d1ef7067' },
              cipher: 'aes-128-ctr',
              kdf: 'scrypt',
              kdfparams: { 
                dklen: 32,
                salt: '22279c6dbcc706d7daa120022a236cfe149496dca8232b0f8159d1df999569d6',
                n: 4096,
                r: 8,
                p: 1 
              },
              mac: '1c54f7378fa279a49a2f790a0adb683defad8535a21bdf2f3dadc48a7bddf517' 
            }
          ] 
        ],
      }
      const password = 'password'
      const expectedAccount = caver.klay.accounts.createWithAccountKey('0x86bce8c859f5f304aa30adb89f2f7b6ee5a0d6e2', {
        transactionKey: ['0xd1e9f8f00ef9f93365f5eabccccb3f3c5783001b61a40f0f74270e50158c163d', '0x4bd8d0b0c1575a7a35915f9af3ef8beb11ad571337ec9b6aca7c88ca7458ef5c'], 
        updateKey: '0xdc2690ac6017e32ef17ea219c2a2fd14a2bb73e7a0a253dfd69abba3eb8d7d91', 
        feePayerKey: ['0xf17bf8b7bee09ffc50a401b7ba8e633b9e55eedcf776782f2a55cf7cc5c40aa8', '0x4f8f1e9e1466609b836dba611a0a24628aea8ee11265f757aa346bde3d88d548']
      })
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV4, password)

      isAccount(result, {keys: expectedAccount.keys, address: expectedAccount.address})
    })
  })

  context('CAVERJS-UNIT-WALLET-384: input: hard coded keystoreJsonV3 that encrypts Account, password', () => {
    it('should decrypt and return valid account', () => {
      const keystoreJsonV3 = { 
        version: 3,
        id: '7a0a8557-22a5-4c90-b554-d6f3b13783ea',
        address: '0x86bce8c859f5f304aa30adb89f2f7b6ee5a0d6e2',
        crypto: { 
          ciphertext: '696d0e8e8bd21ff1f82f7c87b6964f0f17f8bfbd52141069b59f084555f277b7',
          cipherparams: { iv: '1fd13e0524fa1095c5f80627f1d24cbd' },
          cipher: 'aes-128-ctr',
          kdf: 'scrypt',
          kdfparams: { 
            dklen: 32,
            salt: '7ee980925cef6a60553cda3e91cb8e3c62733f64579f633d0f86ce050c151e26',
            n: 4096,
            r: 8,
            p: 1 
          },
          mac: '8684d8dc4bf17318cd46c85dbd9a9ec5d9b290e04d78d4f6b5be9c413ff30ea4' 
        } 
      }
      const password = 'password'
      const expectedAccount = caver.klay.accounts.privateKeyToAccount('0x36e0a792553f94a7660e5484cfc8367e7d56a383261175b9abced7416a5d87df', '0x86bce8c859f5f304aa30adb89f2f7b6ee5a0d6e2')
      
      let result = caver.klay.accounts.decrypt(keystoreJsonV3, password)

      isAccount(result, {keys: expectedAccount.keys, address: expectedAccount.address})
    })
  })


  /*
  it('keystoreJsonV3, password:invalid [KLAYTN-52]', () => {
    const invalid = ''
    const keystoreJsonV3 = caver.klay.accounts.encrypt(account.privateKey, invalid)

    utils.log('input', keystoreJsonV3, invalid)

    const expectedError = {
      name: 'Error',
      message: ''
    }
    validateErrorCodeblock(() => caver.klay.accounts.decrypt(keystoreJsonV3, invalid), expectedError)
  })
  */
})

describe('caver.klay.accounts.getLegacyAccount', () => {
  context('CAVERJS-UNIT-WALLET-106 : input: valid privateKey', () => {
    it('should return account which is derived from private key', () => {
      const testAccount = caver.klay.accounts.create()
      let result = caver.klay.accounts.getLegacyAccount(testAccount.privateKey)

      expect(result.klaytnWalletKeyAddress).to.equals('')
      expect(result.legacyAccount.address).to.equals(testAccount.address)
      expect(result.legacyAccount.privateKey).to.equals(testAccount.privateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-107 : input: nonDecoupled valid KlaytnWalletKey format', () => {
    it('should return account which is derived from private key and address from KlaytnWalletKey format', () => {
      const testAccount = caver.klay.accounts.create()
      let result = caver.klay.accounts.getLegacyAccount(testAccount.getKlaytnWalletKey())

      expect(result.klaytnWalletKeyAddress).to.equals(testAccount.address)
      expect(result.legacyAccount.address).to.equals(result.klaytnWalletKeyAddress)
      expect(result.legacyAccount.privateKey).to.equals(testAccount.privateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-108 : input: decoupled valid KlaytnWalletKey format', () => {
    it('should return account which is derived from private key and address from KlaytnWalletKey format', () => {
      // decoupled
      const privateKey = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const testAccount = caver.klay.accounts.privateKeyToAccount(privateKey, address)

      let result = caver.klay.accounts.getLegacyAccount(testAccount.getKlaytnWalletKey())

      expect(result.klaytnWalletKeyAddress).to.equals(testAccount.address)
      expect(result.legacyAccount.address).not.to.equals(result.klaytnWalletKeyAddress)
      expect(result.legacyAccount.privateKey).to.equals(testAccount.privateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-109 : input: invalid privateKey', () => {
    it('should throw error if input is invalid privateKey string', () => {
      const expectedError = 'Invalid private key'

      expect(() => caver.klay.accounts.getLegacyAccount('0x')).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount('1')).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount('a')).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140FF')).to.throws(expectedError)
    })

    it('should throw error if input is invalid privateKey type', () => {
      const expectedError = 'The private key must be of type string'

      expect(() => caver.klay.accounts.getLegacyAccount(1234)).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount({})).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount()).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount(undefined)).to.throws(expectedError)
      expect(() => caver.klay.accounts.getLegacyAccount(null)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-110 : input: invalid KlaytnWalletKey format', () => {
    it('should throw error if input is invalid KlaytnWalletKey string', () => {
      const expectedError = 'Invalid private key'
      expect(() => caver.klay.accounts.getLegacyAccount(caver.klay.accounts.create().privateKey+'0x000x00')).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.isDecoupled', () => {
  context('CAVERJS-UNIT-WALLET-111 : input: valid privateKey and decoupled address', () => {
    it('should return true if input is decoupled private and address', () => {
      const privateKey = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const testAccount = caver.klay.accounts.privateKeyToAccount(privateKey, address)

      expect(caver.klay.accounts.isDecoupled(testAccount.privateKey, testAccount.address)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-112 : input: valid KlaytnWalletKey', () => {
    it('should return true if input is decoupled KlaytnWalletKey', () => {
      const privateKey = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const testAccount = caver.klay.accounts.privateKeyToAccount(privateKey, address)

      expect(caver.klay.accounts.isDecoupled(testAccount.getKlaytnWalletKey())).to.be.true
      expect(caver.klay.accounts.isDecoupled(testAccount.getKlaytnWalletKey(), testAccount.address)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-113 : input: valid privateKey', () => {
    it('should return false if input is valid privateKey', () => {
      expect(caver.klay.accounts.isDecoupled(caver.klay.accounts.create().privateKey)).to.be.false
      expect(caver.klay.accounts.isDecoupled(caver.klay.accounts.create().privateKey.slice(2))).to.be.false
    })
  })

  context('CAVERJS-UNIT-WALLET-114 : input: valid KlaytnWalletKey', () => {
    it('should return true if input is nonDecoupled KlaytnWalletKey', () => {
      const testAccount = caver.klay.accounts.create()
      expect(caver.klay.accounts.isDecoupled(testAccount.getKlaytnWalletKey())).to.be.false
      expect(caver.klay.accounts.isDecoupled(testAccount.getKlaytnWalletKey(), testAccount.address)).to.be.false
    })
  })

  context('CAVERJS-UNIT-WALLET-115 : input: invalid privateKey', () => {
    it('should throw error if input is invalid privateKey string', () => {
      const expectedError = 'Invalid private key'

      expect(() => caver.klay.accounts.isDecoupled('0x')).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled('1')).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled('a')).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140FF')).to.throws(expectedError)
    })

    it('should throw error if input is invalid privateKey type', () => {
      const expectedError = 'The private key must be of type string'

      expect(() => caver.klay.accounts.isDecoupled(1234)).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled({})).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled()).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled(undefined)).to.throws(expectedError)
      expect(() => caver.klay.accounts.isDecoupled(null)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-116 : input: not match address with KlaytnWalletKey and input', () => {
    it('should throw error if input is invalid privateKey string', () => {
      const privateKey = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const testAccount = caver.klay.accounts.privateKeyToAccount(privateKey, address)

      const expectedError = 'The address extracted from the private key does not match the address received as the input value.'

      expect(() => caver.klay.accounts.isDecoupled(testAccount.getKlaytnWalletKey(), caver.klay.accounts.create().address)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts._getRoleKey', () => {
  let account

  beforeEach(() => {
    const keyObject = {
      transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      updateKey: [caver.klay.accounts.create().privateKey],
      feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
    }
    account = caver.klay.accounts.createWithAccountKey(caver.klay.accounts.create().address, keyObject)
  })

  context('CAVERJS-UNIT-WALLET-133: input: legacy tx and account', () => {
    it('should return transactionKey', () => {
      const tx = {}
      const roleKey = caver.klay.accounts._getRoleKey(tx, account)
      expect(isSameKeyArray(roleKey, account.transactionKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-134: input: update tx and account', () => {
    it('should return updateKey', () => {
      const tx = { type: 'FEE_DELEGATED_ACCOUNT_UPDATE_WITH_RATIO' }
      const roleKey = caver.klay.accounts._getRoleKey(tx, account)
      expect(isSameKeyArray(roleKey, account.updateKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-135: input: tx for fee payer and account', () => {
    it('should return feePayerKey', () => {
      const tx = { senderRawTransaction: '0x', feePayer: account.address }
      const roleKey = caver.klay.accounts._getRoleKey(tx, account)
      expect(isSameKeyArray(roleKey, account.feePayerKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-136: input: tx and account', () => {
    it('should throw error if there is not key matched with role', () => {
      let testAccount = {updateKey: caver.klay.accounts.create().privateKey}
      const expectedError = `The key corresponding to the role used for signing is not defined.`
      expect(() => caver.klay.accounts._getRoleKey({}, testAccount)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-137: input: tx and account', () => {
    it('should throw error if there is not key matched with role', () => {
      let testAccount = {transactionKey: caver.klay.accounts.create().privateKey}
      const expectedError = `The key corresponding to the role used for signing is not defined.`
      expect(() => caver.klay.accounts._getRoleKey({type: 'ACCOUNT_UPDATE'}, testAccount)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-138: input: tx and account', () => {
    it('should throw error if there is not key matched with role', () => {
      let testAccount = {transactionKey: caver.klay.accounts.create().privateKey}
      const expectedError = `The key corresponding to the role used for signing is not defined.`
      expect(() => caver.klay.accounts._getRoleKey({ senderRawTransaction: '0x', feePayer: account.address }, testAccount)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountKey', () => {
  context('CAVERJS-UNIT-WALLET-139: input: private key string`', () => {
    it('should return AccountKeyPublic', () => {
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKey(key)

      expect(accountKey.type).to.equals('AccountKeyPublic')
      expect(accountKey.defaultKey).to.equals(key)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-140: input: array of private key string', () => {
    it('should return accountKeyMultiSig', () => {
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyMultiSig')
      expect(accountKey.defaultKey).to.equals(key[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-141: input: keyObject(transactionKey is defined with private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.transactionKey)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-142: input: keyObject(transactionKey is defined with array of private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.transactionKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-143: input: keyObject(updateKey is defined with private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        updateKey: caver.klay.accounts.create().privateKey
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.updateKey)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-144: input: keyObject(updateKey is defined with array of private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.updateKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-145: input: keyObject(feePayerKey is defined with private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.feePayerKey)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-146: input: keyObject(feePayerKey is defined with array of private key string)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.feePayerKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-147: input: keyObject(transactionKey, updateKey, feePayerKey are defined)', () => {
    it('should return accountKeyRoleBased', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }

      const accountKey = caver.klay.accounts.createAccountKey(key)
      
      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.transactionKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-148: input: invalid type of parameter', () => {
    it('should throw Error', () => {
      let param = 1
      let expectedError = `Invalid accountKey type: ${typeof param}`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)

      param = undefined
      expectedError = `Invalid accountKey type: ${typeof param}`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)

      param = null
      expectedError = `Invalid accountKey type: ${typeof param}`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-149: input: invalid parameter', () => {
    it('should throw Error', () => {
      let param = 'invalidString'
      let expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)

      param = ['invalidString']
      expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)

      param = {}
      expectedError = `Failed to create AccountKeyRoleBased: empty object`
      expect(() => caver.klay.accounts.createAccountKey(param)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountKeyPublic', () => {
  context('CAVERJS-UNIT-WALLET-150: input: private key string`', () => {
    it('should return AccountKeyPublic', () => {
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKeyPublic(key)

      expect(accountKey.type).to.equals('AccountKeyPublic')
      expect(accountKey.defaultKey).to.equals(key)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-151: input: AccountKeyPublic', () => {
    it('should return AccountKeyPublic', () => {
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKeyPublic(caver.klay.accounts.createAccountKeyPublic(key))

      expect(accountKey.type).to.equals('AccountKeyPublic')
      expect(accountKey.defaultKey).to.equals(key)
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-152: input: invalid type of parameter', () => {
    it('should throw Error', () => {
      let param = 1
      let expectedError = `Creating a AccountKeyPublic requires a private key string.`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)

      param = []
      expectedError = `Creating a AccountKeyPublic requires a private key string.`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)

      param = {}
      expectedError = `Creating a AccountKeyPublic requires a private key string.`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)

      param = undefined
      expectedError = `Creating a AccountKeyPublic requires a private key string.`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)

      param = null
      expectedError = `Creating a AccountKeyPublic requires a private key string.`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-153: input: invalid parameter', () => {
    it('should throw Error', () => {
      const param = 'invalidString'
      const expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.createAccountKeyPublic(param)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountKeyMultiSig', () => {
  context('CAVERJS-UNIT-WALLET-154: input: private key string`', () => {
    it('should return AccountKeyMultiSig', () => {
      const key = [caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKeyMultiSig(key)

      expect(accountKey.type).to.equals('AccountKeyMultiSig')
      expect(accountKey.defaultKey).to.equals(key[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-155: input: AccountKeyMultiSig', () => {
    it('should return AccountKeyMultiSig', () => {
      const key = [caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKeyMultiSig(caver.klay.accounts.createAccountKeyMultiSig(key))

      expect(accountKey.type).to.equals('AccountKeyMultiSig')
      expect(accountKey.defaultKey).to.equals(key[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-156: input: invalid type of parameter', () => {
    it('should throw Error', () => {
      let param = 1
      let expectedError = `Creating a AccountKeyMultiSig requires an array of private key string.`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)

      param = 'string'
      expectedError = `Creating a AccountKeyMultiSig requires an array of private key string.`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)

      param = {}
      expectedError = `Creating a AccountKeyMultiSig requires an array of private key string.`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)

      param = undefined
      expectedError = `Creating a AccountKeyMultiSig requires an array of private key string.`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)

      param = null
      expectedError = `Creating a AccountKeyMultiSig requires an array of private key string.`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-157: input: invalid parameter', () => {
    it('should throw Error', () => {
      const param = ['invalidString']
      const expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.createAccountKeyMultiSig(param)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountKeyRoleBased', () => {
  context('CAVERJS-UNIT-WALLET-158: input: private key string', () => {
    it('should return AccountKeyRoleBased', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)

      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.transactionKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-159: input: AccountKeyRoleBased', () => {
    it('should return AccountKeyRoleBased', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(caver.klay.accounts.createAccountKeyRoleBased(key))

      expect(accountKey.type).to.equals('AccountKeyRoleBased')
      expect(accountKey.defaultKey).to.equals(key.transactionKey[0])
      compareAccountKey(accountKey, key)
      expect(typeof accountKey.toPublicKey).to.equals('function')
      expect(typeof accountKey.update).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-160: input: invalid type of parameter', () => {
    it('should throw Error', () => {
      let param = 1
      let expectedError = `Creating a AccountKeyRoleBased requires an object.`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)

      param = 'string'
      expectedError = `Creating a AccountKeyRoleBased requires an object.`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)

      param = []
      expectedError = `Creating a AccountKeyRoleBased requires an object.`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)

      param = undefined
      expectedError = `Creating a AccountKeyRoleBased requires an object.`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)

      param = null
      expectedError = `Creating a AccountKeyRoleBased requires an object.`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-161: input: empty object', () => {
    it('should throw Error', () => {
      let param = {}
      let expectedError = `Failed to create AccountKeyRoleBased: empty object`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-162: input: invalid role is defined', () => {
    it('should throw Error', () => {
      let param = { invalidRole: 'invalidString' }
      expectedError = `Failed to create AccountKeyRoleBased. Invalid role is defined : invalidRole`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-163: input: invalid parameter', () => {
    it('should throw Error', () => {
      let param = { transactionKey: 'invalidString' }
      let expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.createAccountKeyRoleBased(param)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.accountKeyToPublicKey', () => {
  context('CAVERJS-UNIT-WALLET-164: input: private key string', () => {
    it('should return string of public key', () => {
      const key = caver.klay.accounts.create().privateKey
      const expectedPublicKey = caver.klay.accounts.privateKeyToPublicKey(key)

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(expectedPublicKey).to.equals(publicKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-165: input: AccountKeyPublic', () => {
    it('should return string of public key', () => {
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKeyPublic(key)
      const expectedPublicKey = caver.klay.accounts.privateKeyToPublicKey(key)

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(accountKey)

      expect(expectedPublicKey).to.equals(publicKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-166: input: array of private key string', () => {
    it('should return array of public key string', () => {
      const key = [caver.klay.accounts.create().privateKey]
      const expectedPublicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0])]

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(isSameKeyArray(expectedPublicKey, publicKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-167: input: AccountKeyMultiSig', () => {
    it('should return array of public key string', () => {
      const key = [caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKeyMultiSig(key)
      const expectedPublicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0])]

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(accountKey)

      expect(isSameKeyArray(expectedPublicKey, publicKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-168: input: object defines key', () => {
    it('should return object of public key string', () => {
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey],
      }
      const expectedPublicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: caver.klay.accounts.privateKeyToPublicKey(key.updateKey),
        feePayerKey: [caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey[0])],
      }

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(publicKey.transactionKey).to.equals(expectedPublicKey.transactionKey)
      expect(publicKey.updateKey).to.equals(expectedPublicKey.updateKey)
      expect(isSameKeyArray(expectedPublicKey.feePayerKey, publicKey.feePayerKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-169: input: AccountKeyRoleBased', () => {
    it('should return array of public key string', () => {
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey],
      }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)
      const expectedPublicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: caver.klay.accounts.privateKeyToPublicKey(key.updateKey),
        feePayerKey: [caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey[0])],
      }

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(accountKey)

      expect(publicKey.transactionKey).to.equals(expectedPublicKey.transactionKey)
      expect(publicKey.updateKey).to.equals(expectedPublicKey.updateKey)
      expect(isSameKeyArray(expectedPublicKey.feePayerKey, publicKey.feePayerKey)).to.be.true
    })
  })

  context('CAVERJS-UNIT-WALLET-170: input: object defines transactionKey only', () => {
    it('should return object of public key string', () => {
      const key = { transactionKey: caver.klay.accounts.create().privateKey, }
      const expectedPublicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
      }

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(publicKey.transactionKey).to.equals(expectedPublicKey.transactionKey)
      expect(publicKey.updateKey).to.be.undefined
      expect(publicKey.feePayerKey).to.be.undefined
    })
  })

  context('CAVERJS-UNIT-WALLET-171: input: object defines updateKey only', () => {
    it('should return object of public key string', () => {
      const key = { updateKey: caver.klay.accounts.create().privateKey, }
      const expectedPublicKey = {
        updateKey: caver.klay.accounts.privateKeyToPublicKey(key.updateKey),
      }

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(publicKey.transactionKey).to.be.undefined
      expect(publicKey.updateKey).to.equals(expectedPublicKey.updateKey)
      expect(publicKey.feePayerKey).to.be.undefined
    })
  })

  context('CAVERJS-UNIT-WALLET-172: input: object defines feePayerKey only', () => {
    it('should return object of public key string', () => {
      const key = { feePayerKey: caver.klay.accounts.create().privateKey, }
      const expectedPublicKey = {
        feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey),
      }

      const publicKey = caver.klay.accounts.accountKeyToPublicKey(key)

      expect(publicKey.transactionKey).to.be.undefined
      expect(publicKey.updateKey).to.be.undefined
      expect(publicKey.feePayerKey).to.equals(expectedPublicKey.feePayerKey)
    })
  })
})

describe('caver.klay.accounts.createWithAccountKey', () => {
  context('CAVERJS-UNIT-WALLET-173: input: address and private key string', () => {
    it('should return Account with AccountKeyPublic', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey

      const account = caver.klay.accounts.createWithAccountKey(address, key)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key)
      expect(account.accountKeyType).to.equals('AccountKeyPublic')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-174: input: address and array of private key string', () => {
    it('should return Account with AccountKeyMultiSig', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]

      const account = caver.klay.accounts.createWithAccountKey(address, key)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key[0])
      expect(account.accountKeyType).to.equals('AccountKeyMultiSig')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-175: input: address and object of private key', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: [caver.klay.accounts.create().privateKey]
      }

      const account = caver.klay.accounts.createWithAccountKey(address, key)
      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.transactionKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-176: input: address and object defines only transactionKey', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
      }

      const account = caver.klay.accounts.createWithAccountKey(address, key)
      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.transactionKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-177: input: address and object defines only updateKey', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        updateKey: caver.klay.accounts.create().privateKey,
      }

      const account = caver.klay.accounts.createWithAccountKey(address, key)
      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.updateKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-178: input: address and object defines only feePayerKey', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        feePayerKey: caver.klay.accounts.create().privateKey,
      }

      const account = caver.klay.accounts.createWithAccountKey(address, key)
      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.feePayerKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })
})

describe('caver.klay.accounts.createWithAccountKeyPublic', () => {
  context('CAVERJS-UNIT-WALLET-179: input: address and private key string', () => {
    it('should return Account with AccountKeyPublic', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey

      const account = caver.klay.accounts.createWithAccountKeyPublic(address, key)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key)
      expect(account.accountKeyType).to.equals('AccountKeyPublic')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-180: input: address and AccountKeyPublic', () => {
    it('should return Account with AccountKeyPublic', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const account = caver.klay.accounts.createWithAccountKeyPublic(address, accountKey)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key)
      expect(account.accountKeyType).to.equals('AccountKeyPublic')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-181: input: address and array of private key string', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]

      const expectedError = 'Creating a AccountKeyPublic requires a private key string.'

      expect(() => caver.klay.accounts.createWithAccountKeyPublic(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-182: input: address and object', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = {transactionKey: caver.klay.accounts.create().privateKey}
      
      const expectedError = 'Creating a AccountKeyPublic requires a private key string.'

      expect(() => caver.klay.accounts.createWithAccountKeyPublic(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-183: input: address and AccountKeyMultiSig', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyPublic. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyPublic(address, accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-184: input: address and AccountKeyRoleBased', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = {transactionKey: caver.klay.accounts.create().privateKey}
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyPublic. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyPublic(address, accountKey)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createWithAccountKeyMultiSig', () => {
  context('CAVERJS-UNIT-WALLET-185: input: address and array of private key string', () => {
    it('should return Account with AccountKeyMultiSig', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey]

      const account = caver.klay.accounts.createWithAccountKeyMultiSig(address, key)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key[0])
      expect(account.accountKeyType).to.equals('AccountKeyMultiSig')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-186: input: address and AccountKeyMultiSig', () => {
    it('should return Account with AccountKeyMultiSig', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const account = caver.klay.accounts.createWithAccountKeyMultiSig(address, accountKey)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key[0])
      expect(account.accountKeyType).to.equals('AccountKeyMultiSig')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-187: input: address and private key string', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey

      const expectedError = 'Creating a AccountKeyMultiSig requires an array of private key string.'

      expect(() => caver.klay.accounts.createWithAccountKeyMultiSig(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-188: input: address and object', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = {transactionKey: caver.klay.accounts.create().privateKey}
      
      const expectedError = 'Creating a AccountKeyMultiSig requires an array of private key string.'

      expect(() => caver.klay.accounts.createWithAccountKeyMultiSig(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-189: input: address and AccountKeyPublic', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyMultiSig. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyMultiSig(address, accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-190: input: address and AccountKeyRoleBased', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = {transactionKey: caver.klay.accounts.create().privateKey}
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyMultiSig. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyMultiSig(address, accountKey)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createWithAccountKeyRoleBased', () => {
  context('CAVERJS-UNIT-WALLET-191: input: address and object of key', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey
      }

      const account = caver.klay.accounts.createWithAccountKeyRoleBased(address, key)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.transactionKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-192: input: address and AccountKeyRoleBased', () => {
    it('should return Account with AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const account = caver.klay.accounts.createWithAccountKeyRoleBased(address, accountKey)

      isAccount(account, {keys: key, address})
      expect(account.privateKey).to.equals(key.transactionKey)
      expect(account.accountKeyType).to.equals('AccountKeyRoleBased')
      expect(typeof account.toPublicKey).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-193: input: address and private key string', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey

      const expectedError = 'Creating a AccountKeyRoleBased requires an object.'

      expect(() => caver.klay.accounts.createWithAccountKeyRoleBased(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-194: input: address and array of private key string', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey]
      
      const expectedError = 'Creating a AccountKeyRoleBased requires an object.'

      expect(() => caver.klay.accounts.createWithAccountKeyRoleBased(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-195: input: address and AccountKeyPublic', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyRoleBased. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyRoleBased(address, accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-196: input: address and AccountKeyMultiSig', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKey(key)

      const expectedError = `Failed to create account with AccountKeyRoleBased. Invalid account key : ${accountKey.type}`

      expect(() => caver.klay.accounts.createWithAccountKeyRoleBased(address, accountKey)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountForUpdate', () => {
  context('CAVERJS-UNIT-WALLET-197: input: address and private key string', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const publicKey = caver.klay.accounts.privateKeyToPublicKey(key)

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.publicKey).to.equals(publicKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-198: input: address and AccountKeyPublic', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const accountKey = caver.klay.accounts.createAccountKeyPublic(key)
      const publicKey = caver.klay.accounts.privateKeyToPublicKey(key)

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.publicKey).to.equals(publicKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-199: input: address and array of private key string', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const options = { threshold: 2, weight: [1,1] }
      const publicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0]), caver.klay.accounts.privateKeyToPublicKey(key[1])]

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.multisig.threshold).to.equals(options.threshold)
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].weight).to.equals(options.weight[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].publicKey).to.equals(publicKey[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].weight).to.equals(options.weight[1])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].publicKey).to.equals(publicKey[1])
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-200: input: address and AccountKeyMultiSig', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const accountKey = caver.klay.accounts.createAccountKeyMultiSig(key)
      const options = { threshold: 2, weight: [1,1] }
      const publicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0]), caver.klay.accounts.privateKeyToPublicKey(key[1])]

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.multisig.threshold).to.equals(options.threshold)
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].weight).to.equals(options.weight[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].publicKey).to.equals(publicKey[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].weight).to.equals(options.weight[1])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].publicKey).to.equals(publicKey[1])
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-201: input: address and object', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const options = { updateKey: { threshold: 2, weight: [1,1] } }
      const publicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: [caver.klay.accounts.privateKeyToPublicKey(key.updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(key.updateKey[1])],
        feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey)
      }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.publicKey).to.equals(publicKey.transactionKey)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.threshold).to.equals(options.updateKey.threshold)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].weight).to.equals(options.updateKey.weight[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].publicKey).to.equals(publicKey.updateKey[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].weight).to.equals(options.updateKey.weight[1])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].publicKey).to.equals(publicKey.updateKey[1])
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.publicKey).to.equals(publicKey.feePayerKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-202: input: address and AccountKeyRoleBased', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)
      const options = { updateKey: { threshold: 2, weight: [1,1] } }
      const publicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: [caver.klay.accounts.privateKeyToPublicKey(key.updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(key.updateKey[1])],
        feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey)
      }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.publicKey).to.equals(publicKey.transactionKey)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.threshold).to.equals(options.updateKey.threshold)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].weight).to.equals(options.updateKey.weight[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].publicKey).to.equals(publicKey.updateKey[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].weight).to.equals(options.updateKey.weight[1])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].publicKey).to.equals(publicKey.updateKey[1])
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.publicKey).to.equals(publicKey.feePayerKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-203: input: address and object defines transactionKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: caver.klay.accounts.create().privateKey }
      const publicKey = { transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.publicKey).to.equals(publicKey.transactionKey)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey).to.be.undefined
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-204: input: address and AccountKeyRoleBased defines transactionKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: caver.klay.accounts.create().privateKey }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)
      const publicKey = { transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.publicKey).to.equals(publicKey.transactionKey)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey).to.be.undefined
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-205: input: address and object defines updateKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { updateKey: caver.klay.accounts.create().privateKey }
      const publicKey = { updateKey: caver.klay.accounts.privateKeyToPublicKey(key.updateKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.publicKey).to.equals(publicKey.updateKey)
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey).to.be.undefined
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-206: input: address and AccountKeyRoleBased defines updateKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { updateKey: caver.klay.accounts.create().privateKey }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)
      const publicKey = { updateKey: caver.klay.accounts.privateKeyToPublicKey(key.updateKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.publicKey).to.equals(publicKey.updateKey)
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey).to.be.undefined
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-207: input: address and object defines feePayerKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { feePayerKey: caver.klay.accounts.create().privateKey }
      const publicKey = { feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.publicKey).to.equals(publicKey.feePayerKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-208: input: address and AccountKeyRoleBased defines feePayerKey only', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { feePayerKey: caver.klay.accounts.create().privateKey }
      const accountKey = caver.klay.accounts.createAccountKeyRoleBased(key)
      const publicKey = { feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey) }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, accountKey)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.publicKey).to.equals(publicKey.feePayerKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-209: input: address and array of private key without options', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]

      const expectedError = 'For AccountKeyMultiSig, threshold and weight should be defined in options object.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-210: input: address and array of private key with invalid options(weight sum < threshold)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const options = { threshold: 4, weight: [1,1] }

      const expectedError = 'Invalid options for AccountKeyMultiSig: The sum of weights is less than the threshold.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-211: input: address and array of private key with invalid options(weight is not array)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const options = { threshold: 4, weight: 1 }

      const expectedError = 'The weight should be defined as a array.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-212: input: address and array of private key with invalid options(weight length is not matched with key array)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const options = { threshold: 2, weight: [1,1,1,1] }

      const expectedError = 'The length of keys in AccountKeyMultiSig and the length of weight array do not match.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-213: input: address and object has multisig without options', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey] }

      const expectedError = 'For AccountKeyMultiSig, threshold and weight should be defined in options object.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-214: input: address and array of private key with invalid options(weight sum < threshold)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey] }
      const options = { transactionKey: { threshold: 4, weight: [1,1] } }

      const expectedError = 'Invalid options for AccountKeyMultiSig: The sum of weights is less than the threshold.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-215: input: address and array of private key with invalid options(weight is not array)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey] }
      const options = { transactionKey: { threshold: 4, weight: 1 } }

      const expectedError = 'The weight should be defined as a array.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-216: input: address and array of private key with invalid options(weight length is not matched with key array)', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey] }
      const options = { transactionKey: { threshold: 2, weight: [1,1,1,1] } }

      const expectedError = 'The length of keys in AccountKeyMultiSig and the length of weight array do not match.'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-348: input: address and key object which has legacyKey and failKey', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: 'legacyKey', feePayerKey: 'failKey' }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.legacyKey).to.be.true
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey).to.be.undefined
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.failKey).to.be.true
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-349: input: address and key object which has transactionKey(legacyKey), updateKey(multiSigKey) and feePayerKey(failKey)', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const updateKey = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const updatePublicKey = [caver.klay.accounts.privateKeyToPublicKey(updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(updateKey[1])]
      const key = { transactionKey: 'legacyKey', updateKey: updateKey ,feePayerKey: 'failKey' }
      const options = { updateKey: { threshold: 2, weight: [1, 1] } }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdate(address, key, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.legacyKey).to.be.true
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.threshold).to.equals(options.updateKey.threshold)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys.length).to.equals(updateKey.length)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].publicKey).to.equals(updatePublicKey[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].publicKey).to.equals(updatePublicKey[1])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].weight).to.equals(options.updateKey.weight[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].weight).to.equals(options.updateKey.weight[1])
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.failKey).to.be.true
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-350: input: address and key object which has legacyKey and failKey with options', () => {
    it('should throw error', () => {
      const address = caver.klay.accounts.create().address
      const key = { transactionKey: 'legacyKey', feePayerKey: 'failKey' }
      const options = { transactionKey: { threshold: 2, weight: [1,1,1,1] } }

      const expectedError = 'Failed to keyFormatter for AccountForUpdate: AccountKeyPublic/legacyKey/failKey cannot have options'

      expect(() => caver.klay.accounts.createAccountForUpdate(address, key, options)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountForUpdateWithPublicKey', () => {
  context('CAVERJS-UNIT-WALLET-217: input: address and public key string', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const publicKey = caver.klay.accounts.privateKeyToPublicKey(key)

      const accountForUpdate = caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.publicKey).to.equals(publicKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-218: input: address and array of public key string', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const options = { threshold: 2, weight: [1,1] }
      const publicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0]), caver.klay.accounts.privateKeyToPublicKey(key[1])]

      const accountForUpdate = caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey, options)
      
      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.multisig.threshold).to.equals(options.threshold)
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].weight).to.equals(options.weight[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[0].publicKey).to.equals(publicKey[0])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].weight).to.equals(options.weight[1])
      expect(accountForUpdate.keyForUpdate.multisig.keys[1].publicKey).to.equals(publicKey[1])
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-219: input: address and object of public key', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }

      const options = { updateKey: { threshold: 2, weight: [1,1] } }
      const publicKey = {
        transactionKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: [caver.klay.accounts.privateKeyToPublicKey(key.updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(key.updateKey[1])],
        feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey)
      }

      const accountForUpdate = caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey, options)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.roleTransactionKey.publicKey).to.equals(publicKey.transactionKey)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.threshold).to.equals(options.updateKey.threshold)
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].weight).to.equals(options.updateKey.weight[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[0].publicKey).to.equals(publicKey.updateKey[0])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].weight).to.equals(options.updateKey.weight[1])
      expect(accountForUpdate.keyForUpdate.roleAccountUpdateKey.multisig.keys[1].publicKey).to.equals(publicKey.updateKey[1])
      expect(accountForUpdate.keyForUpdate.roleFeePayerKey.publicKey).to.equals(publicKey.feePayerKey)
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })

  context('CAVERJS-UNIT-WALLET-220: input: address and object of public key with invalid role', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      
      const options = { updateKey: { threshold: 2, weight: [1,1] } }
      const publicKey = {
        invalidRoleKey: caver.klay.accounts.privateKeyToPublicKey(key.transactionKey),
        updateKey: [caver.klay.accounts.privateKeyToPublicKey(key.updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(key.updateKey[1])],
        feePayerKey: caver.klay.accounts.privateKeyToPublicKey(key.feePayerKey)
      }

      const expectedError = `Invalid role is defined: invalidRoleKey`

      expect(() => caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey, options)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-221: input: address and array of public key string without options', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const publicKey = [caver.klay.accounts.privateKeyToPublicKey(key[0]), caver.klay.accounts.privateKeyToPublicKey(key[1])]

      const expectedError = 'For AccountKeyMultiSig, threshold and weight should be defined in options object.'

      expect(() => caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-222: input: address and object of public key string without options', () => {
    it('should return AccountForUpdate', () => {
      const address = caver.klay.accounts.create().address
      const key = { updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey] }
      const publicKey = [caver.klay.accounts.privateKeyToPublicKey(key.updateKey[0]), caver.klay.accounts.privateKeyToPublicKey(key.updateKey[1])]

      const expectedError = 'For AccountKeyMultiSig, threshold and weight should be defined in options object.'

      expect(() => caver.klay.accounts.createAccountForUpdateWithPublicKey(address, publicKey)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.createAccountForUpdateWithLegacyKey', () => {
  context('CAVERJS-UNIT-WALLET-223: input: address', () => {
    it('should return AccountForUpdate with legacy key setting', () => {
      const address = caver.klay.accounts.create().address

      const accountForUpdate = caver.klay.accounts.createAccountForUpdateWithLegacyKey(address)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.legacyKey).to.be.true
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })
})

describe('caver.klay.accounts.createAccountForUpdateWithFailKey', () => {
  context('CAVERJS-UNIT-WALLET-224: input: address', () => {
    it('should return AccountForUpdate with fail key setting', () => {
      const address = caver.klay.accounts.create().address

      const accountForUpdate = caver.klay.accounts.createAccountForUpdateWithFailKey(address)

      expect(accountForUpdate.address).to.equals(address)
      expect(accountForUpdate.keyForUpdate.failKey).to.be.true
      expect(typeof accountForUpdate.fillUpdateObject).to.equals('function')
    })
  })
})

describe('caver.klay.accounts.wallet', () => {

  it('CAVERJS-UNIT-WALLET-043 : should return valid wallet instance', () => {
    let result = caver.klay.accounts.wallet
    isWallet(result)

    const accounts = []
    const accountCount = Math.floor(Math.random() * 10) + 1
    for (let i = 0; i < accountCount; i++) {
      const account = caver.klay.accounts.create()
      accounts.push(account)
      caver.klay.accounts.wallet.add(account)
    }

    isWallet(result, { accounts })
  })
})

describe('caver.klay.accounts.wallet.create', () => {

  const validateCheckForWalletCreation = (result, numberOfAccounts) => {
    isWallet(result)
    expect(result.length).to.equal(numberOfAccounts)
    for (let i = 0; i < result.length; i++) {
      const accountByIndex = caver.klay.accounts.createWithAccountKey(result[i].address, result[i].accountKey)
      const accountByAddress = caver.klay.accounts.createWithAccountKey(result[accountByIndex.address].address, result[accountByIndex.address].accountKey)

      isAccount(accountByIndex, { keys: accountByAddress.keys, address: accountByAddress.address })
      isAccount(accountByAddress, { keys: accountByIndex.keys, address: accountByIndex.address })
    }
  }

  context('CAVERJS-UNIT-WALLET-044 : input: numberOfAccounts', () => {
    it('should return valid wallet instance', () => {
      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      let result = caver.klay.accounts.wallet.create(numberOfAccounts)
      validateCheckForWalletCreation(result, numberOfAccounts)
    })
  })

  context('CAVERJS-UNIT-WALLET-045 : input: numberOfAccounts:invalid', () => {
    it('should return 0 wallet', () => {
      const invalid = -1
      let result = caver.klay.accounts.wallet.create(invalid)
      validateCheckForWalletCreation(result, 0)
    })
  })

  context('CAVERJS-UNIT-WALLET-046 : input: numberOfAccounts, entropy', () => {
    it('should return valid wallet instance', () => {
      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      const entropy = caver.utils.randomHex(32)

      let result = caver.klay.accounts.wallet.create(numberOfAccounts, entropy)
      validateCheckForWalletCreation(result, numberOfAccounts)
    })
  })
})

describe('caver.klay.accounts.wallet.add', () => {
  const validateCheckForWalletAddition = (data, { account, wallet }) => {
    const accounts = []  

    accounts.push(caver.klay.accounts.createWithAccountKey(data.address, data.accountKey))
    accounts.push(caver.klay.accounts.createWithAccountKey(wallet[data.index].address, wallet[data.index].accountKey))
    accounts.push(caver.klay.accounts.createWithAccountKey(wallet[data.address].address, wallet[data.address].accountKey))

    for (v of accounts) {
      isAccount(v, { keys: account.keys, address: account.address })
    }
  }

  context('CAVERJS-UNIT-WALLET-047 : input: account', () => {
    it('should have valid wallet instance after addition', () => {
      let account = caver.klay.accounts.create()
      let result = caver.klay.accounts.wallet.add(account)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-048 : input: privateKey', () => {
    it('should have valid wallet instance after addition', () => {
      account = caver.klay.accounts.create()
      result = caver.klay.accounts.wallet.add(account.privateKey)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-052 : input: KlaytnWalletKey', () => {
    it('should have valid wallet instance after addition', () => {
      // KlaytnWalletkey with nonHumanReadableAddress
      var klaytnWalletKey = '0x600dfc414fe433881f6606c24955e4143df9d203ccb3e335efe970a4ad017d040x000xee135d0b57c7ff81b198763cfd7c43f03a5f7622'
      account = caver.klay.accounts.privateKeyToAccount(klaytnWalletKey)
      result = caver.klay.accounts.wallet.add(klaytnWalletKey)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })

      // KlaytnWalletkey with nonHumanReadableAddress (decoupled)
      var klaytnWalletKey = '0x600dfc414fe433881f6606c24955e4143df9d203ccb3e335efe970a4ad017d040x000x34ef488daef1da6fcc3470be0a5351dc223e20d0'
      account = caver.klay.accounts.privateKeyToAccount(klaytnWalletKey)
      result = caver.klay.accounts.wallet.add(klaytnWalletKey)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-050, CAVERJS-UNIT-WALLET-051 : input: privateKey, address', () => {
    it('should have valid wallet instance after addition', () => {
      account = caver.klay.accounts.create()
      result = caver.klay.accounts.wallet.add(account.privateKey, account.address)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })

      account = caver.klay.accounts.create()
      var address = '0xc98e2616b445d0b7ff2bcc45adc554ebbf5fd576'
      account.address = address
      result = caver.klay.accounts.wallet.add(account.privateKey, address)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })

      account = caver.klay.accounts.create()
      address = '0x6a61736d696e652e6b6c6179746e000000000000'
      account.address = address
      result = caver.klay.accounts.wallet.add(account.privateKey, address)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-053 CAVERJS-UNIT-WALLET-054 : input: KlaytnWalletKey, address', () => {
    it('should have valid wallet instance after addition', () => {
      klaytnWalletKey = '0xc1ad21b3da99cbb6a57cf181ec3e36af77ae37112585f700c81db19115f74b110x000xc4f88823f5030e4343c1494b502d534e9f15152d'
      account = caver.klay.accounts.privateKeyToAccount(klaytnWalletKey)
      result = caver.klay.accounts.wallet.add(klaytnWalletKey, account.address)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })

      // decoupled
      klaytnWalletKey = '0xc1ad21b3da99cbb6a57cf181ec3e36af77ae37112585f700c81db19115f74b110x000x95e024d64534948a89748d4c3e82e02d05721beb'
      account = caver.klay.accounts.privateKeyToAccount(klaytnWalletKey)
      result = caver.klay.accounts.wallet.add(klaytnWalletKey, account.address)

      validateCheckForWalletAddition(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-055 : input: KlaytnWalletKey, invalid address', () => {
    it('should have valid wallet instance after addition', () => {
      klaytnWalletKey = '0x2d21dc5d73e29177af17a1376f3e5769b94086479735e711670c2d599c3f97ab0x000x53b0e6ebd395093d83ac9b0e1e47b4b31b7c18c4'
      account = caver.klay.accounts.privateKeyToAccount(klaytnWalletKey)
      expect(()=> caver.klay.accounts.wallet.add(klaytnWalletKey, '0x95e024d64534948a89748d4c3e82e02d05721beb')).to.throw()
    })
  })

  context('CAVERJS-UNIT-WALLET-056 : input: invalid KlaytnWalletKey', () => {
    it('should have valid wallet instance after addition', () => {
      klaytnWalletKey = '0x39d87f15c695ec94d6d7107b48dee85e252f21fedd371e1c6badc4afa71efbdf0x010x167bcdef96658b7b7a94ac398a8e7275e719a10c'
      expect(()=> caver.klay.accounts.wallet.add(klaytnWalletKey)).to.throw()
    })
  })

  context('CAVERJS-UNIT-WALLET-049 : input: account:invalid', () => {
    it('should throw an error', () => {
      const invalid = -1
      const errorMessage = 'Invalid accountKey type: number'
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throw(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-244: input: userInputAddress and AccountKeyPublic', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const accountKeyPublic = caver.klay.accounts.createAccountKeyPublic(key)
      const accountWithPublic = caver.klay.accounts.createWithAccountKey(address, accountKeyPublic)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyPublic, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithPublic, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-245: input: userInputAddress and AccountKeyMultiSig', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const address = caver.klay.accounts.create().address
      const accountKeyMultiSig = caver.klay.accounts.createAccountKeyMultiSig(key)
      const accountWithMultiSig = caver.klay.accounts.createWithAccountKey(address, accountKeyMultiSig)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyMultiSig, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithMultiSig, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-246: input: userInputAddress and AccountKeyRoleBased which defines transactionKey, updateKey and feePayerKey', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountKeyRoleBased = caver.klay.accounts.createAccountKeyRoleBased(key)
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, accountKeyRoleBased)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyRoleBased, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-247: input: userInputAddress and AccountKeyRoleBased which defines transactionKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountKeyRoleBased = caver.klay.accounts.createAccountKeyRoleBased(key)
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, accountKeyRoleBased)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyRoleBased, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-248: input: userInputAddress and AccountKeyRoleBased which defines updateKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        updateKey: caver.klay.accounts.create().privateKey
      }
      const address = caver.klay.accounts.create().address
      const accountKeyRoleBased = caver.klay.accounts.createAccountKeyRoleBased(key)
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, accountKeyRoleBased)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyRoleBased, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-249: input: userInputAddress and AccountKeyRoleBased which defines feePayerKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountKeyRoleBased = caver.klay.accounts.createAccountKeyRoleBased(key)
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, accountKeyRoleBased)

      let accountInWallet = caver.klay.accounts.wallet.add(accountKeyRoleBased, address)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-250: input: AccountKeyPublic without userInputAddress', () => {
    it('should throw error', () => {
      const accountKey = caver.klay.accounts.createAccountKey(caver.klay.accounts.create().privateKey)

      const expectedError = `Address is not defined. Address cannot be determined from AccountKey`
      expect(() => caver.klay.accounts.wallet.add(accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-251: input: AccountKeyMultiSig without userInputAddress', () => {
    it('should throw error', () => {
      const accountKey = caver.klay.accounts.createAccountKey([caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey])

      const expectedError = `Address is not defined. Address cannot be determined from AccountKey`
      expect(() => caver.klay.accounts.wallet.add(accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-252: input: AccountKeyRoleBased without userInputAddress', () => {
    it('should throw error', () => {
      const accountKey = caver.klay.accounts.createAccountKey({transactionKey: caver.klay.accounts.create().privateKey})

      const expectedError = `Address is not defined. Address cannot be determined from AccountKey`
      expect(() => caver.klay.accounts.wallet.add(accountKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-253: input: Account with AccountKeyPublic', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const accountWithPublic = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithPublic)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithPublic, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-254: input: Account with AccountKeyMultiSig', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const address = caver.klay.accounts.create().address
      const accountWithMultiSig = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithMultiSig)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithMultiSig, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-255: input: Account with AccountKeyRoleBased which defines transactionKey, updateKey and feePayerKey', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithRoleBased)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-256: input: Account with AccountKeyRoleBased which defines transactionKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithRoleBased)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-257: input: Account with AccountKeyRoleBased which defines updateKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        updateKey: caver.klay.accounts.create().privateKey
      }
      const address = caver.klay.accounts.create().address
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithRoleBased)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-258: input: Account with AccountKeyRoleBased which defines feePayerKey only', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = {
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const accountWithRoleBased = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithRoleBased)
      validateCheckForWalletAddition(accountInWallet, { account: accountWithRoleBased, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-259: input: Account with AccountKeyPublic and userInputAddress', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const accountWithPublic = caver.klay.accounts.createWithAccountKey(address, key)
      const userInputAddrees = caver.klay.accounts.create().address

      let accountInWallet = caver.klay.accounts.wallet.add(accountWithPublic, userInputAddrees)
      accountWithPublic.address = userInputAddrees

      validateCheckForWalletAddition(accountInWallet, { account: accountWithPublic, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-260: input: object which has address and privateKey', () => {
    it('should have valid Account instance in wallet after addition', () => {
      const key = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const accountWithPublic = caver.klay.accounts.createWithAccountKey(address, key)

      const inputObject = {
        address: accountWithPublic.address,
        privateKey: accountWithPublic.privateKey,
      }

      let accountInWallet = caver.klay.accounts.wallet.add(inputObject)
      
      validateCheckForWalletAddition(accountInWallet, { account: accountWithPublic, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-261: input: userInputAddress and object which has address and privateKey', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = caver.klay.accounts.create().privateKey
      const address = caver.klay.accounts.create().address
      const accountWithPublic = caver.klay.accounts.createWithAccountKey(address, key)
      const userInputAddrees = caver.klay.accounts.create().address

      const inputObject = {
        address: accountWithPublic.address,
        privateKey: accountWithPublic.privateKey,
      }

      let accountInWallet = caver.klay.accounts.wallet.add(inputObject, userInputAddrees)
      accountWithPublic.address = userInputAddrees
      
      validateCheckForWalletAddition(accountInWallet, { account: accountWithPublic, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-262: input: userInputAddress and array of private key string', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const address = caver.klay.accounts.create().address
      const account = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(key, address)
      
      validateCheckForWalletAddition(accountInWallet, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-263: input: userInputAddress and key object which defines transactionKey, updateKey and feePayerKey', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const account = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(key, address)
      
      validateCheckForWalletAddition(accountInWallet, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-264: input: userInputAddress and key object which defines transactionKey only', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const account = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(key, address)
      
      validateCheckForWalletAddition(accountInWallet, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-265: input: userInputAddress and key object which defines updateKey only', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = {
        updateKey: caver.klay.accounts.create().privateKey
      }
      const address = caver.klay.accounts.create().address
      const account = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(key, address)
      
      validateCheckForWalletAddition(accountInWallet, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-266: input: userInputAddress and key object which defines feePayerKey only', () => {
    it('should have valid Account instance with userInputAddress as an address in wallet after addition', () => {
      const key = {
        feePayerKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      }
      const address = caver.klay.accounts.create().address
      const account = caver.klay.accounts.createWithAccountKey(address, key)

      let accountInWallet = caver.klay.accounts.wallet.add(key, address)
      
      validateCheckForWalletAddition(accountInWallet, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-267: input: invalid type parameter', () => {
    it('should throw error', () => {
      let invalid = {}

      let expectedError = `Failed to create AccountKeyRoleBased: empty object`
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throws(expectedError)

      invalid = undefined
      expectedError = `Invalid accountKey type: ${typeof invalid}`
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throws(expectedError)

      invalid = null
      expectedError = `Invalid accountKey type: ${typeof invalid}`
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throws(expectedError)

      invalid = 1
      expectedError = `Invalid accountKey type: ${typeof invalid}`
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-268: input: invalid role defined', () => {
    it('should throw error', () => {
      const invalid = {invalidRole: caver.klay.accounts.create().privateKey}

      const expectedError = `Failed to create AccountKeyRoleBased. Invalid role is defined : invalidRole`
      expect(() => caver.klay.accounts.wallet.add(invalid)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.wallet.remove', () => {

  const validateCheckForWalletRemove = (data, { expected=true, account, wallet }) => {
    expect(data).to.equal(expected)

    if (data) {
      expect(typeof wallet[account.address]).to.equal('undefined')
    }
  }

  context('CAVERJS-UNIT-WALLET-057, CAVERJS-UNIT-WALLET-058, CAVERJS-UNIT-WALLET-059 : input: account', () => {
    it('should remove wallet instance', () => {
      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      caver.klay.accounts.wallet.create(numberOfAccounts)

      let account = caver.klay.accounts.wallet[Math.floor(Math.random() * numberOfAccounts)]

      let result = caver.klay.accounts.wallet.remove(account.index)
      validateCheckForWalletRemove(result, { account: account, wallet: caver.klay.accounts.wallet })

      account = caver.klay.accounts.create()
      caver.klay.accounts.wallet.add(account.privateKey)

      result = caver.klay.accounts.wallet.remove(account.address)
      validateCheckForWalletRemove(result, { account: account, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-060 : input: account:invalid', () => {
    it('should return false for removing invalid wallet instance index', () => {
      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      caver.klay.accounts.wallet.create(numberOfAccounts)

      let invalid = -1
      let result = caver.klay.accounts.wallet.remove(invalid)
      validateCheckForWalletRemove(result, { expected: false })

      invalid = numberOfAccounts
      result = caver.klay.accounts.wallet.remove(invalid)
      validateCheckForWalletRemove(result, { expected: false })
    })
  })

  context('CAVERJS-UNIT-WALLET-269: input: Account with AccountKeyPublic', () => {
    it('should remove wallet instance', () => {
      const address = caver.klay.accounts.create().address
      const key = caver.klay.accounts.create().privateKey
      const account = caver.klay.accounts.createWithAccountKey(address, key)
      let accountInWallet = caver.klay.accounts.wallet.add(account)

      let result = caver.klay.accounts.wallet.remove(accountInWallet.index)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })

      accountInWallet = caver.klay.accounts.wallet.add(account)

      result = caver.klay.accounts.wallet.remove(accountInWallet.address)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-270: input: Account with AccountKeyMultiSig', () => {
    it('should remove wallet instance', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const account = caver.klay.accounts.createWithAccountKey(address, key)
      let accountInWallet = caver.klay.accounts.wallet.add(account)

      let result = caver.klay.accounts.wallet.remove(accountInWallet.index)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })

      accountInWallet = caver.klay.accounts.wallet.add(account)

      result = caver.klay.accounts.wallet.remove(accountInWallet.address)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-271: input: Account with AccountKeyRoleBased', () => {
    it('should remove wallet instance', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      const account = caver.klay.accounts.createWithAccountKey(address, key)
      let accountInWallet = caver.klay.accounts.wallet.add(account)

      let result = caver.klay.accounts.wallet.remove(accountInWallet.index)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })

      accountInWallet = caver.klay.accounts.wallet.add(account)

      result = caver.klay.accounts.wallet.remove(accountInWallet.address)

      expect(accountInWallet.accountKey).to.be.null
      validateCheckForWalletRemove(result, { account: accountInWallet, wallet: caver.klay.accounts.wallet })
    })
  })
})

describe('caver.klay.accounts.wallet.clear', () => {
  context('CAVERJS-UNIT-WALLET-061 : input: no parameter', () => {
    it('should clear all wallet instance', () => {
      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      caver.klay.accounts.wallet.create(numberOfAccounts)

      let result = caver.klay.accounts.wallet.clear()
      isWallet(result)
      expect(result.length).to.equal(0)
      expect(caver.klay.accounts.wallet.length).to.equal(0)

      result = caver.klay.accounts.wallet.clear()
      isWallet(result)
      expect(result.length).to.equal(0)
      expect(caver.klay.accounts.wallet.length).to.equal(0)
    })
  })
})

describe('caver.klay.accounts.wallet.encrypt', () => {

  context('CAVERJS-UNIT-WALLET-062 : input: password', () => {
    it('should encrypted as v4Keystore', () => {
      const password = 'klaytn!@'

      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      caver.klay.accounts.wallet.create(numberOfAccounts)

      let result = caver.klay.accounts.wallet.encrypt(password)

      expect(result.length).to.equal(caver.klay.accounts.wallet.length)
      result.forEach((v, i) => {
        isKeystoreV4(v, { address: caver.klay.accounts.wallet[i].address })
      })
      const decryptedWallet = caver.klay.accounts.wallet.decrypt(result, password)
      isWallet(decryptedWallet, { accounts: caver.klay.accounts.wallet })
    })
  })

  context('CAVERJS-UNIT-WALLET-272: input: password', () => {
    it('should throw error if there is Account with AccountKeyMultiSig or AccountKeyRoleBased', () => {
      const password = 'klaytn!@'

      // AccountKeyMultiSig
      let address = caver.klay.accounts.create().address
      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(address, key))

      // AccountKeyRoleBased
      let roleBasedaddress = caver.klay.accounts.create().address
      let roleBasedkey = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(roleBasedaddress, roleBasedkey))

      let result = caver.klay.accounts.wallet.encrypt(password)

      expect(result.length).to.equal(caver.klay.accounts.wallet.length)
      result.forEach((v, i) => {
        isKeystoreV4(v, { address: caver.klay.accounts.wallet[i].address })
      })
      const decryptedWallet = caver.klay.accounts.wallet.decrypt(result, password)
      isWallet(decryptedWallet, { accounts: caver.klay.accounts.wallet })

    })
  })


  /*
  it('password:invalid [KLAYTN-52]', () => {
    const invalid = ''

    const numberOfAccounts = Math.floor(Math.random() * 5) + 1
    caver.klay.accounts.wallet.create(numberOfAccounts)

    utils.log('input', invalid)

    const expectedError = {
      name: 'Error',
      message: ''
    }
    validateErrorCodeblock(() => caver.klay.accounts.wallet.encrypt(invalid), expectedError)
  })
  */
})

describe('caver.klay.accounts.wallet.decrypt', () => {

  context('CAVERJS-UNIT-WALLET-063 : input: keystoreArray, password', () => {
    it('should decrypt v4Keystore to account instance', () => {
      const password = 'klaytn!@'

      const numberOfAccounts = Math.floor(Math.random() * 5) + 1
      caver.klay.accounts.wallet.create(numberOfAccounts)

      // AccountKeyMultiSig
      let address = caver.klay.accounts.create().address
      let key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(address, key))

      // AccountKeyRoleBased
      let roleBasedaddress = caver.klay.accounts.create().address
      let roleBasedkey = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(roleBasedaddress, roleBasedkey))

      const encryptedKeystore = caver.klay.accounts.wallet.encrypt(password)
      caver.klay.accounts.wallet.clear()

      const result = caver.klay.accounts.wallet.decrypt(encryptedKeystore, password)
      isWallet(result, { accounts: caver.klay.accounts.wallet })
    })
  })

  /*
  it('keystoreArray, password:invalid [KLAYTN-52]', () => {
    const invalid = ''

    const numberOfAccounts = Math.floor(Math.random() * 5) + 1
    caver.klay.accounts.wallet.create(numberOfAccounts)

    const encryptedKeystore = caver.klay.accounts.wallet.encrypt(invalid)

    utils.log('input', encryptedKeystore, invalid)

    const expectedError = {
      name: 'Error',
      message: ''
    }
    validateErrorCodeblock(() => caver.klay.accounts.wallet.decrypt(encryptedKeystore, invalid), expectedError)
  })
  */
})

describe('caver.klay.accounts.wallet.getAccount', () => {
  context('CAVERJS-UNIT-WALLET-125 : input: number', () => {
    it('should return Account from Wallet', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())

      const fromWallet = caver.klay.accounts.wallet.getAccount(testAccount.index)

      expect(testAccount.address).to.equals(fromWallet.address)
      expect(testAccount.privateKey).to.equals(fromWallet.privateKey)
      expect(testAccount.index).to.equals(fromWallet.index)
    })
  })

  context('CAVERJS-UNIT-WALLET-126 : input: invalid number index', () => {
    it('should throw Error', () => {
      const errorMessage = `The index(${caver.klay.accounts.wallet.length}) is out of range(Wallet length : ${caver.klay.accounts.wallet.length}).`

      expect(() => caver.klay.accounts.wallet.getAccount(caver.klay.accounts.wallet.length)).to.throws(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-127 : input: invalid parameter type for getAccount', () => {
    it('should throw Error', () => {
      const errorMessage = `Accounts in the Wallet can be searched by only index or address.`

      expect(() => caver.klay.accounts.wallet.getAccount({})).to.throws(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-128 : input: invalid address for getAccount', () => {
    it('should throw Error', () => {
      const input = 'address'
      const errorMessage = `Failed to getAccount from Wallet: invalid address(${input})`

      expect(() => caver.klay.accounts.wallet.getAccount(input)).to.throws(errorMessage)
    })
  })

  context('CAVERJS-UNIT-WALLET-129 : input: validAddress', () => {
    it('should return Account from Wallet', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())

      let fromWallet = caver.klay.accounts.wallet.getAccount(testAccount.address)

      expect(testAccount.address).to.equals(fromWallet.address)
      expect(testAccount.privateKey).to.equals(fromWallet.privateKey)
      expect(testAccount.index).to.equals(fromWallet.index)

      fromWallet = caver.klay.accounts.wallet.getAccount(testAccount.address.toLowerCase())

      expect(testAccount.address).to.equals(fromWallet.address)
      expect(testAccount.privateKey).to.equals(fromWallet.privateKey)
      expect(testAccount.index).to.equals(fromWallet.index)

      fromWallet = caver.klay.accounts.wallet.getAccount(testAccount.address.toUpperCase())

      expect(testAccount.address).to.equals(fromWallet.address)
      expect(testAccount.privateKey).to.equals(fromWallet.privateKey)
      expect(testAccount.index).to.equals(fromWallet.index)
    })
  })
})

describe('caver.klay.accounts.wallet.updatePrivateKey', () => {
  context('CAVERJS-UNIT-WALLET-322: input: private key string and address', () => {
    it('should update the private key of account by updating the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const originalPrivateKey = testAccount.privateKey
      const updatePrivateKey = caver.klay.accounts.create().privateKey

      let account = caver.klay.accounts.wallet.getAccount(testAccount.address)
      expect(account.privateKey).to.equals(originalPrivateKey)

      account = caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey, testAccount.address)
      expect(account.privateKey).to.equals(updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-323: input: KlaytnWalletKey and address', () => {
    it('should update the private key of account by updating the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const originalPrivateKey = testAccount.privateKey
      const updatedAccount = caver.klay.accounts.createWithAccountKey(testAccount.address, caver.klay.accounts.create().privateKey)
      const klaytnWalletKey = updatedAccount.getKlaytnWalletKey()
      const updatedPrivateKey = updatedAccount.privateKey

      let account = caver.klay.accounts.wallet.getAccount(testAccount.address)
      expect(account.privateKey).to.equals(originalPrivateKey)

      account = caver.klay.accounts.wallet.updatePrivateKey(klaytnWalletKey, testAccount.address)
      expect(account.privateKey).to.equals(updatedPrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-324: input: private key or address are undefined', () => {
    it('should throw error', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = caver.klay.accounts.create().privateKey

      const expectedError = `To update the privatKey in wallet, need to set both privateKey and address.`

      expect(() => caver.klay.accounts.wallet.updatePrivateKey()).to.throws(expectedError)
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey)).to.throws(expectedError)
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(undefined, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-325: input: invalid type of privateKey', () => {
    it('should throw error', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      
      let invalid = ''
      let expectedError = `Invalid private key(${invalid})`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)

      invalid = {}
      expectedError = `The private key used for the update is not a valid string.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)

      invalid = 1
      expectedError = `The private key used for the update is not a valid string.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)

      invalid = []
      expectedError = `The private key used for the update is not a valid string.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-326: input: private key string and address', () => {
    it('should throw error when accountKey in Account is AccountKeyMultiSig', () => {
      const address = caver.klay.accounts.create().address
      const key = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(address, key))
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      let expectedError = `Account using AccountKeyMultiSig or AccountKeyRoleBased must be updated using the caver.klay.accounts.updateAccountKey function.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-327: input: private key string and address', () => {
    it('should throw error when accountKey in Account is AccountKeyRoleBased', () => {
      const address = caver.klay.accounts.create().address
      const key = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: caver.klay.accounts.create().privateKey,
        feePayerKey: caver.klay.accounts.create().privateKey
      }
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(address, key))
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      let expectedError = `Account using AccountKeyMultiSig or AccountKeyRoleBased must be updated using the caver.klay.accounts.updateAccountKey function.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-328: input: invalid private key string and address', () => {
    it('should throw error', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      let invalid = '0x01'
      
      let expectedError = `Invalid private key(${invalid.slice(2)})`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)

      invalid = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364142'
      expectedError = `Invalid private key`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(invalid, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-329: input: KlaytnWalletKey and address', () => {
    it('should throw error when address from KlaytnWalletKey is not matched with address parameter', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatedAccount = caver.klay.accounts.createWithAccountKey(caver.klay.accounts.create().address, caver.klay.accounts.create().privateKey)
      const klaytnWalletKey = updatedAccount.getKlaytnWalletKey()
      
      let expectedError = `The address extracted from the private key does not match the address received as the input value.`
      expect(() => caver.klay.accounts.wallet.updatePrivateKey(klaytnWalletKey, testAccount.address)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-330: input: not existed address of account', () => {
    it('should throw error when account cannot be found with address', () => {
      const notExistAddress = caver.klay.accounts.create().address
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      const expectedError = `Failed to find account with ${notExistAddress}`

      expect(() => caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey, notExistAddress)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-331: input: invalid address', () => {
    it('should throw error when account cannot be found with address', () => {
      const invalidAddress = 'invalidAddress'
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      const expectedError = `Invalid address : ${invalidAddress}`

      expect(() => caver.klay.accounts.wallet.updatePrivateKey(updatePrivateKey, invalidAddress)).to.throws(expectedError)
    })
  })
})

describe('caver.klay.accounts.wallet.updateAccountKey', () => {
  context('CAVERJS-UNIT-WALLET-332: input: address and private key string', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = caver.klay.accounts.create().privateKey

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-333: input: address and AccountKeyPublic', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = caver.klay.accounts.createAccountKeyPublic(caver.klay.accounts.create().privateKey)

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-334: input: address and array of private key string', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey]

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-335: input: address and AccountKeyMultiSig', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = caver.klay.accounts.createAccountKeyMultiSig([caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey])

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-336: input: address and key object which defines transactionKey, updateKey and feePayerKey', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-337: input: address and AccountKeyRoleBased which defines transactionKey, updateKey and feePayerKey', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const keyObject = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const updatePrivateKey = caver.klay.accounts.createAccountKeyRoleBased(keyObject)

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-338: input: address and key object which defines transactionKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = {
        transactionKey: caver.klay.accounts.create().privateKey,
      }

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-339: input: address and AccountKeyRoleBased which defines transactionKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const keyObject = {
        transactionKey: caver.klay.accounts.create().privateKey,
      }
      const updatePrivateKey = caver.klay.accounts.createAccountKeyRoleBased(keyObject)

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-340: input: address and key object which defines updateKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = {
        updateKey: caver.klay.accounts.create().privateKey,
      }

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-341: input: address and AccountKeyRoleBased which defines updateKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const keyObject = {
        updateKey: caver.klay.accounts.create().privateKey,
      }
      const updatePrivateKey = caver.klay.accounts.createAccountKeyRoleBased(keyObject)

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-342: input: address and key object which defines feePayerKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const updatePrivateKey = {
        feePayerKey: caver.klay.accounts.create().privateKey,
      }

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-343: input: address and AccountKeyRoleBased which defines feePayerKey only', () => {
    it('should update the accountKey', () => {
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.create())
      const keyObject = {
        updateKey: caver.klay.accounts.create().privateKey,
      }
      const updatePrivateKey = caver.klay.accounts.createAccountKeyRoleBased(keyObject)

      account = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      compareAccountKey(account.accountKey, updatePrivateKey.keys)
    })
  })

  context('CAVERJS-UNIT-WALLET-344: input: address of role based account and key object which defines role key partially', () => {
    it('should update the key defined inside the AccountKey only', () => {
      const originalKeyObject = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(caver.klay.accounts.create().address, originalKeyObject))
      
      const keyObject = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      
      let updatedAccount = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, keyObject)
      
      const expectedUpdatedKey = {
        transactionKey: keyObject.transactionKey,
        updateKey: keyObject.updateKey,
        feePayerKey: originalKeyObject.feePayerKey
      }
      compareAccountKey(updatedAccount.accountKey, expectedUpdatedKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-345: input: address of role based account and AccountKeyRoleBased which defines role key partially', () => {
    it('should update the key defined inside the AccountKey only', () => {
      const originalKeyObject = {
        transactionKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
        feePayerKey: caver.klay.accounts.create().privateKey,
      }
      const testAccount = caver.klay.accounts.wallet.add(caver.klay.accounts.createWithAccountKey(caver.klay.accounts.create().address, originalKeyObject))
      
      const keyObject = {
        transactionKey: caver.klay.accounts.create().privateKey,
        updateKey: [caver.klay.accounts.create().privateKey, caver.klay.accounts.create().privateKey],
      }
      
      const updatePrivateKey = caver.klay.accounts.createAccountKeyRoleBased(keyObject)
      
      let updatedAccount = caver.klay.accounts.wallet.updateAccountKey(testAccount.address, updatePrivateKey)
      
      const expectedUpdatedKey = {
        transactionKey: keyObject.transactionKey,
        updateKey: keyObject.updateKey,
        feePayerKey: originalKeyObject.feePayerKey
      }
      compareAccountKey(updatedAccount.accountKey, expectedUpdatedKey)
    })
  })

  context('CAVERJS-UNIT-WALLET-346: input: not existed address of account', () => {
    it('should throw error when account cannot be found with address', () => {
      const notExistAddress = caver.klay.accounts.create().address
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      const expectedError = `Failed to find account with ${notExistAddress}`

      expect(() => caver.klay.accounts.wallet.updateAccountKey(notExistAddress, updatePrivateKey)).to.throws(expectedError)
    })
  })

  context('CAVERJS-UNIT-WALLET-347: input: invalid address', () => {
    it('should throw error when account cannot be found with address', () => {
      const invalidAddress = 'invalidAddress'
      const updatePrivateKey = caver.klay.accounts.create().privateKey
      
      const expectedError = `Invalid address : ${invalidAddress}`

      expect(() => caver.klay.accounts.wallet.updateAccountKey(invalidAddress, updatePrivateKey)).to.throws(expectedError)
    })
  })
})