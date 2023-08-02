import { Contract } from '@algorandfoundation/tealscript'

class charityCrowdfundingApp extends Contract {
  goal = new GlobalStateKey<uint64>()
  detail = new GlobalStateKey<String>()
  title = new GlobalStateKey<String>()
  fundRaised = new GlobalStateKey<uint64>()
  donatorNum = new GlobalStateKey<uint64>()
  minDonation = new GlobalStateKey<uint64>()
  active = new GlobalStateKey<uint64>()
  donatorInfo = new BoxMap<Address, uint64>()

  authorizeCreator(): void {
    assert(this.app.creator == this.txn.sender)
  }

  optInAsset(assetId: Asset): void {
    this.authorizeCreator()
    sendAssetTransfer({
      assetAmount: 0,
      assetReceiver: this.app.address,
      fee: 0,
      xferAsset: assetId,
    })
  }

  bootstrap(title: String, detail: String, goal: uint64, minDonation: uint64, nftTransfer: AssetTransferTxn): void {
    this.authorizeCreator()

    assert(nftTransfer.assetReceiver == this.app.address)
    assert(nftTransfer.assetAmount > 0)
    this.title.set(title)
    this.detail.set(detail)
    this.goal.set(goal)
    this.minDonation.set(minDonation)
    this.fundRaised.set(0)
    this.donatorNum.set(0)
    this.active.set(1)
  }

  fund(mbrPay: PayTxn, fundPay: PayTxn): void {
    assert(this.active.get() == 1)
    assert(mbrPay.amount > 0)
    assert(mbrPay.receiver == this.app.address)
    assert(fundPay.sender == this.txn.sender)
    assert(fundPay.amount >= this.minDonation.get())
    assert(fundPay.receiver == this.app.address)

    this.donatorInfo.set(this.txn.sender, fundPay.amount)
    this.fundRaised.set(this.fundRaised.get() + fundPay.amount)
    this.donatorNum.set(this.donatorNum.get() + 1)
  }

  claimNFT(optin: AssetTransferTxn, nft: Asset): void {
    assert(this.active.get() == 1)
    assert(this.donatorInfo.exists(this.txn.sender))
    assert(this.donatorInfo.get(this.txn.sender) >= 0)
    assert(optin.assetReceiver == this.txn.sender)
    assert(optin.xferAsset == nft)
    assert(optin.assetAmount == 0)

    sendAssetTransfer({
      xferAsset: nft,
      assetAmount: 1,
      assetReceiver: this.txn.sender,
      fee: 0,
    })
  }

  claimFund(): uint64 {
    const totalRaisedFunds = this.fundRaised.get()

    this.authorizeCreator()
    assert(this.active.get() == 1)
    assert(totalRaisedFunds >= this.goal.get())

    sendPayment({
      amount: totalRaisedFunds,
      receiver: this.app.creator,
      fee: 0,
    })

    this.active.set(0)
    this.fundRaised.set(0)
    return totalRaisedFunds
  }

  deleteDonatorInfo(donator: Account): void {
    this.authorizeCreator()
    assert(this.active.get() == 0)
    assert(this.donatorInfo.exists(donator))
    this.donatorInfo.delete(donator)
  }

  // @handle.deleteApplication
  // delete(): void {
  //   this.authorizeCreator()
  //   assert(this.active.get() == 0)
  //   assert(this.fundRaised.get() == 0)
  // }
}
