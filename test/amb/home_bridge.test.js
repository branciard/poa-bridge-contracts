const Web3Utils = require('web3-utils');
const HomeAMB = artifacts.require("HomeAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const Box = artifacts.require("Box.sol");
const requiredBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const { ERROR_MSG, ZERO_ADDRESS } = require('../setup');
const { strip0x } = require('../helpers/helpers');


contract('HomeAMB', async (accounts) => {
  let validatorContract, authorities, owner;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('balance', () => {
    let boxContract
    before(async () => {
      boxContract = await Box.new()
    })
    it('should start with zero balance', async () => {
      const homeBridge = await HomeAMB.new()
      const balance = await homeBridge.balanceOf(boxContract.address)
      '0'.should.be.bignumber.equal(balance)
    })

    it('should receive balance for a contract', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.depositForContractSender(boxContract.address, {
        from: accounts[1],
        value: 1
      })
      const deposit = await homeBridge.balanceOf(boxContract.address)
      const balance = await web3.eth.getBalance(homeBridge.address)
      '1'.should.be.bignumber.equal(deposit)
      '1'.should.be.bignumber.equal(balance)
    })

    it('should revert for address 0', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.depositForContractSender(ZERO_ADDRESS, {
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)

      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)

    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const homeBridge = await HomeAMB.new()
      '0'.should.be.bignumber.equal(await homeBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      false.should.be.equal(await homeBridge.isInitialized())

      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations).should.be.fulfilled;

      (await homeBridge.deployedAtBlock()).should.be.bignumber.above(0);
      (await homeBridge.validatorContract()).should.be.equal(validatorContract.address);
      (await homeBridge.maxPerTx()).should.be.bignumber.equal(oneEther);
      (await homeBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await homeBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);
    })
  })
  describe('requireToPassMessage', () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256) should fail', async () => {
      try {
        // Should fail because subsidized mode not set by default
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          1535604485,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256)', async () => {
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) should fail', async () => {
      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1)', async () => {
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) should fail', async () => {
      const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

      // Should fail because gas < minimumGasUsage
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        10,
        1).should.be.rejectedWith(ERROR_MSG)

      // Should fail because gas > maxGasPerTx
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        twoEther,
        1).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('executeAffirmation', () => {
    let homeBridge, setValueData, box
    beforeEach(async () => {
      homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      const result = await box.getSetValueData(3)
      setValueData = result.logs[0].args.selectorData
    })
    it('should succeed on Subsidized mode', async () => {
      // set Home bridge on subsidized mode
      await homeBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Use these calls to simulate foreign bridge on Foreign network
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        221254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should succeed on defrayal mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, gasPrice, requiredBlockConfirmations)

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await homeBridgeWithThreeSigs.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)
      const msgHash = Web3Utils.soliditySha3(message);

      const {logs} = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      });

      const notProcessed = await homeBridgeWithThreeSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(1);

      await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;

      secondSignature.logs[0].event.should.be.equal("SignedForAffirmation");
      secondSignature.logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;

      thirdSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      thirdSignature.logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      const senderHash = Web3Utils.soliditySha3(authoritiesFiveAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash))

      const senderHash2 = Web3Utils.soliditySha3(authoritiesFiveAccs[1], msgHash);
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash2))

      const senderHash3 = Web3Utils.soliditySha3(authoritiesFiveAccs[2], msgHash);
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash3))

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should not allow to double execute', async () => {
      const user = accounts[8]

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      await homeBridge.executeAffirmation(message, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.executeAffirmation(message, {from: authorities[1]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow non-authorities to execute withdraw', async () => {
      const user = accounts[8]

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      await homeBridge.executeAffirmation(message, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.executeAffirmation(message, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
    })
  })
})
