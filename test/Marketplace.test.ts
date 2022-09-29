import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, constants } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

describe("Marketplace contract", function () {
  let merketplaceFactory;
  let marketplace: any;
  let accounts: SignerWithAddress[];
  let nftCollectionAddress: string;
  let token: any;
  let nftContract: any;
  const collectionCreatedInterface = new ethers.utils.Interface([
    "event CollectionCreated(string collectionName, address collectionAddress)",
  ]);
  const fixedPricedInterface = new ethers.utils.Interface([
    "event ListedNFT(uint256 _tokenId,address owner,address collectionAddress,string listType,uint256 price)",
  ]);
  const offerInterface = new ethers.utils.Interface([
    "event  MakeOffer(uint256 _tokenId,address collectionAddress,uint256 offer, address buyer)",
  ]);
  const sellNftInterface = new ethers.utils.Interface([
    "event NFTBought(uint256 _tokenId, address collectionAddress,address newOwner)",
  ]);
  const cancelInterface = new ethers.utils.Interface([
    "event CancelListing(uint256 _tokenId, address collectionAddress)",
  ]);

  before(async () => {
    merketplaceFactory = await ethers.getContractFactory("Marketplace");
    accounts = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory(
      "MyToken"
    );
    token = await tokenFactory.deploy("MyToken", "Token");
    await token.deployed();
    await token.connect(accounts[1]).mint();
    await token.connect(accounts[2]).mintWithNumberOfTokens(BigNumber.from("1"));
    marketplace = await merketplaceFactory.deploy(token.address);
    await marketplace.deployed();
  });

  it("Should create collection", async () => {
    const collectionTnx = await marketplace.createCollection("none", "Test", "TST");
    const receipt = await ethers.provider.getTransactionReceipt(collectionTnx.hash);
    const data = receipt.logs[0].data;
    const topics = receipt.logs[0].topics;
    const event = collectionCreatedInterface.decodeEventLog(
      "CollectionCreated",
      data,
      topics
    );

    nftCollectionAddress = event[1];
    nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    expect(nftCollectionAddress).to.be.a("string");
  });

  it("Should mint token from eligible collection address", async () => {
    for (let i = 0; i < 5; i++) {
      await marketplace.mintToken(nftCollectionAddress, "test");
      let ownerAddress = await nftContract.ownerOf(i);
      await expect(ownerAddress).to.equal(accounts[0].address);
    }
  });

  it("Should not mint token from not eligible collection address", async () => {
    await expect(marketplace.mintToken(constants.AddressZero, "test"))
      .to.be.revertedWith("Cannot mint");
  });

  it("Should list fixed priced NFT", async () => {
    await nftContract.approve(marketplace.address, 0);
    const priceTnx = await marketplace.listFixedPriceNFT(BigNumber.from(1), 0, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(priceTnx.hash);
    const data = receipt.logs[0].data;
    const topics = receipt.logs[0].topics;
    const event = fixedPricedInterface.decodeEventLog(
      "ListedNFT",
      data,
      topics
    );

    const tokenId = event[0];
    const owner = event[1];
    const listType = event[3];
    const price = event[4];
    expect(tokenId).to.equal(0);
    expect(owner).to.equal(accounts[0].address);
    expect(listType).to.equal("fixed");
    expect(price).to.equal(BigNumber.from(1));
  });

  it("Should not make offer on fixed priced NFT", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 0, nftCollectionAddress))
      .to.be.revertedWith("Bid unavailible");
  });

  it("Should not sell fixed priced NFT", async () => {
    await expect(marketplace.sellNFT(0, nftCollectionAddress))
      .to.be.revertedWith("Not for bid sell");
  });

  it("Should not list not approved and not owner fixed priced NFT", async () => {
    await expect(marketplace.listFixedPriceNFT(BigNumber.from(1), 1, nftCollectionAddress))
      .to.be.revertedWith("Not approved");
    await expect(marketplace.connect(accounts[1]).listFixedPriceNFT(BigNumber.from(1), 1, nftCollectionAddress))
      .to.be.revertedWith("Not the owner");
  });

  it("Should not buy without price fixed priced NFT", async () => {
    await expect(marketplace.connect(accounts[1]).buyFixedPriceNFT(0, nftCollectionAddress, { value: BigNumber.from(0) }))
      .to.be.revertedWith("Not enough to buy");
  });

  it("Should buy fixed priced NFT", async () => {
    await marketplace.connect(accounts[1]).buyFixedPriceNFT(0, nftCollectionAddress, { value: BigNumber.from(1) });
    const ownerAddress = await nftContract.ownerOf(0);
    expect(ownerAddress).to.equal(accounts[1].address);
  });

  it("Should buy fixed priced NFT with change ", async () => {
    await nftContract.approve(marketplace.address, 2);

    const buyerOldBalance = formatEther(await accounts[3].getBalance());
    await marketplace.listFixedPriceNFT(BigNumber.from("10000000000000000000"), 2, nftCollectionAddress);

    const buyTnx = await marketplace.connect(accounts[3]).buyFixedPriceNFT(2, nftCollectionAddress, { value: BigNumber.from("20000000000000000000") });
    const receipt = await ethers.provider.getTransactionReceipt(buyTnx.hash);
    const ownerAddress = await nftContract.ownerOf(0);
    const buyerNewBalance = formatEther(buyTnx.gasPrice.mul(receipt.gasUsed).add(await accounts[3].getBalance()));

    expect(ownerAddress).to.equal(accounts[1].address);
    expect(+buyerOldBalance - +buyerNewBalance).to.equal(10);
  });

  it("Should list bidding NFT", async () => {
    const priceTnx = await marketplace.listBiddingNFT(BigNumber.from(1), 1, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(priceTnx.hash);
    const data = receipt.logs[0].data;
    const topics = receipt.logs[0].topics;
    const event = fixedPricedInterface.decodeEventLog(
      "ListedNFT",
      data,
      topics
    );

    const tokenId = event[0];
    const owner = event[1];
    const listType = event[3];
    const price = event[4];
    expect(tokenId).to.equal(1);
    expect(owner).to.equal(accounts[0].address);
    expect(listType).to.equal("bidding");
    expect(price).to.equal(BigNumber.from(1));
  });

  it("Should not buy bidding NFT", async () => {
    await await expect(marketplace.connect(accounts[1]).buyFixedPriceNFT(1, nftCollectionAddress, { value: BigNumber.from(1) }))
      .to.be.revertedWith("Not a fixed sell");
  });

  it("Should not make offer with less price", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(0), 1, nftCollectionAddress))
      .to.be.revertedWith("The price is low");
  });

  it("Should not make offer with insufficient funds", async () => {
    await expect(marketplace.connect(accounts[2]).makeOffer(BigNumber.from("1000000000000000001"), 1, nftCollectionAddress))
      .to.be.revertedWith("Not enough tokens");
  });

  it("Should not make with insufficient allowance offer", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 1, nftCollectionAddress))
      .to.be.revertedWith("Insufficient allowance");
  });

  it("Should make offer", async () => {
    await token.connect(accounts[1]).increaseAllowance(marketplace.address, BigNumber.from(2));
    const priceTnx = await marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 1, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(priceTnx.hash);
    const data = receipt.logs[0].data;
    const topics = receipt.logs[0].topics;
    const event = offerInterface.decodeEventLog(
      "MakeOffer",
      data,
      topics
    );

    const tokenId = event[0];
    const offer = event[2];
    const buyer = event[3];
    expect(tokenId).to.equal(1);
    expect(offer).to.equal(BigNumber.from(2));
    expect(buyer).to.equal(accounts[1].address);
  });

  it("Should not sell NFT without approve", async () => {
    await expect(marketplace.sellNFT(1, nftCollectionAddress))
      .to.be.revertedWith("Not approved");
  });

  it("Should sell NFT", async () => {
    await nftContract.approve(marketplace.address, 1);
    const sellTnx = await marketplace.sellNFT(1, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(sellTnx.hash);

    const data = receipt.logs[4].data;
    const topics = receipt.logs[4].topics;
    const event = sellNftInterface.decodeEventLog(
      "NFTBought",
      data,
      topics
    );

    const tokenId = event[0];
    const owner = event[2];
    expect(tokenId).to.equal(1);
    expect(owner).to.equal(accounts[1].address);
  });

  it("Should cancel NFT listing", async () => {
    await nftContract.approve(marketplace.address, 3);
    await marketplace.listFixedPriceNFT(BigNumber.from(1), 3, nftCollectionAddress);

    const cancelTnx = await marketplace.cancelNFTListing(3, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(cancelTnx.hash);
    const data = receipt.logs[0].data;
    const topics = receipt.logs[0].topics;
    const event = cancelInterface.decodeEventLog(
      "CancelListing",
      data,
      topics
    );
    const tokenId = event[0].toNumber();
    const collectionAddress = event[1];
    expect(tokenId).to.equal(3);
    expect(collectionAddress).to.equal(nftCollectionAddress);
  });

  it("Should make offer without listing the NFT", async () => {
    await token.connect(accounts[1]).increaseAllowance(marketplace.address, BigNumber.from(2));
    await marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 4, nftCollectionAddress);

    await nftContract.approve(marketplace.address, 4);
    const sellTnx = await marketplace.sellNFT(4, nftCollectionAddress);
    const receipt = await ethers.provider.getTransactionReceipt(sellTnx.hash);

    const data = receipt.logs[4].data;
    const topics = receipt.logs[4].topics;
    const event = sellNftInterface.decodeEventLog(
      "NFTBought",
      data,
      topics
    );

    const tokenId = event[0];
    const owner = event[2];
    expect(tokenId).to.equal(4);
    expect(owner).to.equal(accounts[1].address);
  });
});
