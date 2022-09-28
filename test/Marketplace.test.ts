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

  it("Create collection", async () => {
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
    expect(nftCollectionAddress).to.be.a("string");
  });

  it("Mint token from eligible collection address", async () => {
    await marketplace.mintToken(nftCollectionAddress, "test");
    let nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    let ownerAddress = await nftContract.ownerOf(0);
    await expect(ownerAddress).to.equal(accounts[0].address);

    await marketplace.mintToken(nftCollectionAddress, "test");
    nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    ownerAddress = await nftContract.ownerOf(1);
    await expect(ownerAddress).to.equal(accounts[0].address);

    await marketplace.mintToken(nftCollectionAddress, "test");
    nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    ownerAddress = await nftContract.ownerOf(2);
    await expect(ownerAddress).to.equal(accounts[0].address);

    await marketplace.mintToken(nftCollectionAddress, "test");
    nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    ownerAddress = await nftContract.ownerOf(3);
    await expect(ownerAddress).to.equal(accounts[0].address);
  });

  it("Mint token from not eligible collection address", async () => {
    await expect(marketplace.mintToken(constants.AddressZero, "test"))
      .to.be.revertedWith("Cannot mint");
  });

  it("List fixed priced NFT", async () => {
    const nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
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

  it("Make offer on fixed priced NFT", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 0, nftCollectionAddress))
      .to.be.revertedWith("Bid unavailible");
  });

  it("Sell fixed priced NFT", async () => {
    await expect(marketplace.sellNFT(0, nftCollectionAddress))
      .to.be.revertedWith("Not for bid sell");
  });

  it("List not approved and not owner fixed priced NFT", async () => {
    await expect(marketplace.listFixedPriceNFT(BigNumber.from(1), 1, nftCollectionAddress))
      .to.be.revertedWith("Not approved");
    await expect(marketplace.connect(accounts[1]).listFixedPriceNFT(BigNumber.from(1), 1, nftCollectionAddress))
      .to.be.revertedWith("Not the owner");
  });

  it("Buy without price fixed priced NFT", async () => {
    await expect(marketplace.connect(accounts[1]).buyFixedPriceNFT(0, nftCollectionAddress, { value: BigNumber.from(0) }))
      .to.be.revertedWith("Not enough to buy");
  });

  it("Buy fixed priced NFT", async () => {
    await marketplace.connect(accounts[1]).buyFixedPriceNFT(0, nftCollectionAddress, { value: BigNumber.from(1) });
    const nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
    const ownerAddress = await nftContract.ownerOf(0);

    expect(ownerAddress).to.equal(accounts[1].address);
  });

  it("Buy fixed priced NFT with change ", async () => {
    const nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);

    await nftContract.approve(marketplace.address, 2);

    const sellerOldBalance = formatEther(await accounts[0].getBalance());
    const buyerOldBalance = formatEther(await accounts[3].getBalance());
    await marketplace.listFixedPriceNFT(BigNumber.from("10000000000000000000"), 2, nftCollectionAddress);
    await marketplace.connect(accounts[3]).buyFixedPriceNFT(2, nftCollectionAddress, { value: BigNumber.from("20000000000000000000") });

    const ownerAddress = await nftContract.ownerOf(0);
    const sellerNewBalance = formatEther(await accounts[0].getBalance());
    const buyerNewBalance = formatEther(await accounts[3].getBalance());

    expect(ownerAddress).to.equal(accounts[1].address);
    expect(Math.round(+sellerNewBalance - +sellerOldBalance)).to.equal(10);
    expect(Math.round(+buyerOldBalance - +buyerNewBalance)).to.equal(10);
  });

  it("List bidding NFT", async () => {
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

  it("Try buying bidding NFT", async () => {
    await await expect(marketplace.connect(accounts[1]).buyFixedPriceNFT(1, nftCollectionAddress, { value: BigNumber.from(1) }))
      .to.be.revertedWith("Not a fixed sell");
  });

  it("Make offer with less price", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(0), 1, nftCollectionAddress))
      .to.be.revertedWith("The price is low");
  });

  it("Make offer with insufficient funds", async () => {
    await expect(marketplace.connect(accounts[2]).makeOffer(BigNumber.from("1000000000000000001"), 1, nftCollectionAddress))
      .to.be.revertedWith("Not enough tokens");
  });

  it("Make with insufficient allowance offer", async () => {
    await expect(marketplace.connect(accounts[1]).makeOffer(BigNumber.from(2), 1, nftCollectionAddress))
      .to.be.revertedWith("Insufficient allowance");
  });

  it("Make offer", async () => {
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

  it("Sell NFT without approve", async () => {
    await expect(marketplace.sellNFT(1, nftCollectionAddress))
      .to.be.revertedWith("Not approved");
  });

  it("Sell NFT", async () => {
    const nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);
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

  it("Cancel NFT listing", async () => {
    const nftContract = await ethers.getContractAt("NFTCollection", nftCollectionAddress);

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
});
