import * as algokit from '@algorandfoundation/algokit-utils'
import { CharityCrowdfundingAppClient } from '../artifacts-tealscript/client'
import algosdk from 'algosdk'
import { mintRewardNft } from './mint_nft'

async function printBoxes(appClient: CharityCrowdfundingAppClient) {
  const boxes = await appClient.appClient.getBoxNames()
  console.log(`${boxes.length} boxes found`)
  for (const boxName of boxes) {
    const encodedName = algosdk.encodeAddress(boxName.nameRaw)
    console.log('box Name:', encodedName)
    const content = await appClient.appClient.getBoxValueFromABIType(boxName, new algosdk.ABIUintType(64))
    console.log(Number(content) / 1_000_000, 'ALGO')
  }
}

export async function deploy() {
  console.log('=== Deploying CharityCrowdfunding ===')

  const algod = algokit.getAlgoClient()
  const indexer = algokit.getAlgoIndexerClient()
  const deployer = await algokit.getLocalNetDispenserAccount(algod)
  // const deployer = await algokit.getAccount(
  //   { config: algokit.getAccountConfigFromEnvironment('DEPLOYER'), fundWith: algokit.algos(100) },
  //   algod,
  // )

  // await algokit.ensureFunded(
  //   {
  //     accountToFund: deployer,
  //     minSpendingBalance: algokit.algos(2),
  //     minFundingIncrement: algokit.algos(2),
  //   },
  //   algod,
  // )

  const appClient = new CharityCrowdfundingAppClient(
    {
      resolveBy: 'creatorAndName',
      findExistingUsing: indexer,
      sender: deployer,
      creatorAddress: deployer.addr,
    },
    algod,
  )
  // const app = await appClient.deploy({
  //   onSchemaBreak: 'replace',
  //   onUpdate: 'append',
  // })

  // // If app was just created fund the app account
  // if (['create', 'replace'].includes(app.operationPerformed)) {
  //   algokit.transferAlgos(
  //     {
  //       amount: algokit.algos(0.2),
  //       from: deployer,
  //       to: app.appAddress,
  //     },
  //     algod,
  //   )
  // }

  const app = await appClient.appClient.create()

  algokit.transferAlgos(
    {
      amount: algokit.algos(0.2),
      from: deployer,
      to: app.appAddress,
    },
    algod,
  )

  // Mint Reward NFT
  const rewardNftId = await mintRewardNft()

  // Reward NFT Optin
  let sp = await algod.getTransactionParams().do()

  // const sendParams: SendTransactionParams = {
  //   suppressLog: false,
  //   fee: new AlgoAmount({ microAlgos: sp.minFee * 2 }),
  // }

  await appClient.optInAsset(
    { assetId: rewardNftId },
    {
      sendParams: {
        fee: algokit.transactionFees(2), //covers inner transaction
        suppressLog: true,
      },
    },
  )

  /*
  Boostrap Fundraise
  - set title, description, fundraise goal, minimum donation amount
  - transfer Reward NFT to smart contract
  */

  const title = 'Save The Planet Fundraiser'
  const detail = 'The world is getting sicker everyday and we need your help!'
  const goal = algokit.algos(2)
  const minDonate = algokit.algos(0.1) // 0.1 ALGO

  let sp2 = await algod.getTransactionParams().do()

  const rewardNftTransferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: deployer.addr,
    suggestedParams: sp2,
    to: app.appAddress,
    amount: 10000,
    assetIndex: rewardNftId,
  })

  // const rewardNftTransferTxnSigner = await algokit.getTransactionWithSigner(rewardNftTransferTxn, deployer)

  // console.log('Fundraiser Details Before Bootstrap')
  // const global_states = await appClient.getGlobalState()
  // console.log('\t Fundraise Title: ', global_states['title']?.asString())
  // console.log('\t Fundraise Goal: ', global_states['goal']?.asNumber(), ' MicroAlgos')
  // console.log('\t Minimum Donation: ', global_states['min_donation']?.asNumber(), ' MicroAlgos')

  await appClient.bootstrap(
    {
      title: title,
      detail: detail,
      goal: goal.valueOf(),
      minDonation: minDonate.valueOf(),
      nftTransfer: { transaction: rewardNftTransferTxn, signer: deployer },
    },
    {
      sendParams: {
        suppressLog: true,
      },
    },
  )

  console.log('Fundraiser Details after bootstrap')
  const global_state2 = await appClient.getGlobalState()
  console.log('\t Fundraise Title: ', global_state2['title']?.asString())
  console.log('\t Fundraise Goal: ', global_state2['goal']?.asNumber(), ' MicroAlgos')
  console.log('\t Minimum Donation: ', global_state2['min_donation']?.asNumber(), ' MicroAlgos')

  // Prepare account 2 and 3 app client
  const donator1 = await algokit.getAccount(
    { config: algokit.getAccountConfigFromEnvironment('DONATOR1'), fundWith: algokit.algos(100) },
    algod,
  )

  await algokit.ensureFunded(
    {
      accountToFund: donator1,
      minSpendingBalance: algokit.algos(100),
      minFundingIncrement: algokit.algos(80),
    },
    algod,
  )

  console.log('donator1 address: ', donator1.addr)

  const donator2 = await algokit.getAccount(
    { config: algokit.getAccountConfigFromEnvironment('DONATOR2'), fundWith: algokit.algos(100) },
    algod,
  )

  await algokit.ensureFunded(
    {
      accountToFund: donator2,
      minSpendingBalance: algokit.algos(100),
      minFundingIncrement: algokit.algos(80),
    },
    algod,
  )

  await algokit.ensureFunded(
    {
      accountToFund: deployer,
      minSpendingBalance: algokit.algos(2),
      minFundingIncrement: algokit.algos(2),
    },
    algod,
  )
  console.log('donator2 address: ', donator2.addr)

  const appClient2 = new CharityCrowdfundingAppClient(
    {
      resolveBy: 'id',
      id: app.appId,
      sender: donator1,
    },
    algod,
  )

  const appClient3 = new CharityCrowdfundingAppClient(
    {
      resolveBy: 'id',
      id: app.appId,
      sender: donator2,
    },
    algod,
  )

  // Fund with donator1 and donator2
  sp = await algod.getTransactionParams().do()

  const BOX_MBR = 2500 + (32 + 8) * 400 // = 18500

  /*
  atomically group 3 transactions to fund
  1. payment txn to cover box MBR
  2. payment txn to fund the fundraiser
  3. App Call calling the fund method
  */

  // Pay Box MBR
  const mbrPayTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: donator1.addr,
    suggestedParams: sp,
    to: app.appAddress,
    amount: algokit.microAlgos(BOX_MBR).valueOf(),
  })

  // Donate 1 Algo
  const donateTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: donator1.addr,
    suggestedParams: sp,
    to: app.appAddress,
    amount: algokit.algos(1).valueOf(),
  })

  // Call fund method
  await appClient2.fund(
    { mbrPay: mbrPayTxn, fundPay: donateTxn },
    {
      sendParams: {
        suppressLog: true,
      },
      boxes: [{ appId: app.appId, name: donator1 }],
    },
  )

  // Do the same for donator2
  const mbrPayTxn2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: donator2.addr,
    suggestedParams: sp,
    to: app.appAddress,
    amount: algokit.microAlgos(BOX_MBR).valueOf(),
  })

  // Donate 1 Algo
  const donateTxn2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: donator2.addr,
    suggestedParams: sp,
    to: app.appAddress,
    amount: algokit.algos(1).valueOf(),
  })

  // Call fund method
  await appClient3.fund(
    { mbrPay: mbrPayTxn2, fundPay: donateTxn2 },
    {
      sendParams: {
        suppressLog: true,
      },
      boxes: [{ appId: app.appId, name: donator2 }],
    },
  )

  console.log('Donator 2, 3 funded the fundraiser')

  // Check created Boxes
  printBoxes(appClient)

  // Donator 1 and 2 claim Reward NFT
  const sp3 = await algod.getTransactionParams().do()
  const optinTxns: algosdk.Transaction[] = []

  for (const donator of [donator1, donator2]) {
    const optinTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: donator.addr,
      suggestedParams: sp3,
      to: donator.addr,
      amount: 0,
      assetIndex: rewardNftId,
    })

    optinTxns.push(optinTxn)
  }
  // Donator1 calls claimNFT

  await appClient2.claimNft(
    { optin: optinTxns[0], nft: rewardNftId },
    { sendParams: { fee: algokit.transactionFees(2), suppressLog: true }, boxes: [donator1] },
  ) // cover txn fee of optin and the inner txn sending the nft to the account

  const donator1AssetInfo = await algod.accountAssetInformation(donator1.addr, rewardNftId).do()
  console.log(
    'Donator 1 received ',
    donator1AssetInfo['asset-holding'].amount,
    'asset with id ',
    donator1AssetInfo['asset-holding']['asset-id'],
  )
  // Donator2 calls claimNFT
  await appClient3.claimNft(
    { optin: optinTxns[1], nft: rewardNftId },
    { sendParams: { fee: algokit.transactionFees(2), suppressLog: true }, boxes: [donator2] },
  ) // cover txn fee of optin and the inner txn sending the nft to the account

  const donator2AssetInfo = await algod.accountAssetInformation(donator1.addr, rewardNftId).do()
  console.log(
    'Donator 2 received ',
    donator2AssetInfo['asset-holding'].amount,
    'asset with id ',
    donator2AssetInfo['asset-holding']['asset-id'],
  )

  // Fundraiser creator claim all Funds
  const result = await appClient.claimFund({}, { sendParams: { fee: algokit.transactionFees(2), suppressLog: true } })
  console.log('Total claimed Funds: ', Number(result.return) / 1_000_000, 'Algos')

  // Check that the remaining app address balance == minimum balance
  const appAcctInfo = await algod.accountInformation(app.appAddress).do()
  const resultMessage = appAcctInfo.amount === appAcctInfo['min-balance'] ? 'balance == min-bal' : 'balance != min-bal'
  console.log(resultMessage)

  // Delete boxes
  const boxes = await appClient.appClient.getBoxNames()
  for (const boxName of boxes) {
    const encodedName = algosdk.encodeAddress(boxName.nameRaw)
    await appClient.deleteDonatorInfo(
      { donator: encodedName },
      {
        sendParams: {
          suppressLog: true,
        },
        boxes: [{ appId: app.appId, name: boxName.nameRaw }],
      },
    )
    console.log('Box with name ', encodedName, 'is Deleted')
  }
  const boxes2 = await appClient.appClient.getBoxNames()
  console.log(boxes2.length, ' boxes found')

  // delete app
  // try {
  //   await appClient.delete
  // } catch (e) {
  //   console.log(e)
  // }
  // console.log('App Deleted')
}
