//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NFTCollection.sol";
import "./MyToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// TODO: Implement all user stories and one of the feature request
contract Marketplace {
    event CollectionCreated(string collectionName, address collectionAddress);
    event TokenMinted(
        uint256 _tokenId,
        address owner,
        address collectionAddress
    );
    event ListedNFT(
        uint256 _tokenId,
        address owner,
        address collectionAddress,
        string listType,
        uint256 price
    );
    event MakeOffer(
        uint256 _tokenId,
        address collectionAddress,
        uint256 offer,
        address buyer
    );
    event NFTBought(
        uint256 _tokenId,
        address collectionAddress,
        address newOwner
    );
    event CancelListing(uint256 _tokenId, address collectionAddress);

    mapping(address => mapping(uint256 => uint256)) prices;
    mapping(address => mapping(uint256 => uint8)) typeOfTheListedNFT;
    mapping(address => mapping(uint256 => address)) biders;
    mapping(address => bool) whiteListedCollections;

    ERC20 token;

    modifier onlyFromWhiteListedCollection(address collectionAddress) {
        require(
            whiteListedCollections[collectionAddress] == true,
            "Cannot mint"
        );
        _;
    }

    modifier onlyOwnerOfNFT(
        address collectionAddress,
        uint256 tokenId,
        address owner
    ) {
        require(
            ERC721(collectionAddress).ownerOf(tokenId) == owner,
            "Not the owner"
        );
        _;
    }

    constructor(address tokenAddress) {
        token = ERC20(tokenAddress);
    }

    function createCollection(
        string memory description,
        string memory collectionName,
        string memory collectionSymbol
    ) public returns (address) {
        NFTCollection nftCollection = new NFTCollection(
            description,
            collectionName,
            collectionSymbol,
            address(this)
        );
        address collectionAddress = address(nftCollection);
        whiteListedCollections[collectionAddress] = true;
        emit CollectionCreated(collectionName, collectionAddress);
        return collectionAddress;
    }

    function mintToken(address collectionAddress, string memory ipfsHash)
        public
        onlyFromWhiteListedCollection(collectionAddress)
    {
        uint256 tokenId = NFTCollection(collectionAddress).mintToken(
            msg.sender,
            ipfsHash
        );
        emit TokenMinted(tokenId, msg.sender, collectionAddress);
    }

    function listFixedPriceNFT(
        uint256 price,
        uint256 tokenId,
        address collectionAddress
    ) public onlyOwnerOfNFT(collectionAddress, tokenId, msg.sender) {
        require(
            ERC721(collectionAddress).getApproved(tokenId) == address(this),
            "Not approved"
        );
        prices[collectionAddress][tokenId] = price;
        typeOfTheListedNFT[collectionAddress][tokenId] = 1;
        emit ListedNFT(tokenId, msg.sender, collectionAddress, "fixed", price);
    }

    function buyFixedPriceNFT(uint256 tokenId, address collectionAddress)
        public
        payable
    {
        ERC721 nftCollection = ERC721(collectionAddress);
        require(
            msg.value >= prices[collectionAddress][tokenId],
            "Not enough to buy"
        );
        require(
            typeOfTheListedNFT[collectionAddress][tokenId] == 1,
            "Not a fixed sell"
        );

        address owner = nftCollection.ownerOf(tokenId);
        nftCollection.safeTransferFrom(owner, msg.sender, tokenId);
        payable(owner).transfer(prices[collectionAddress][tokenId]);

        if (msg.value > prices[collectionAddress][tokenId]) {
            uint256 change = msg.value - prices[collectionAddress][tokenId];
            payable(msg.sender).transfer(change);
        }

        delete prices[collectionAddress][tokenId];
        delete typeOfTheListedNFT[collectionAddress][tokenId];

        emit NFTBought(tokenId, collectionAddress, msg.sender);
    }

    function listBiddingNFT(
        uint256 price,
        uint256 tokenId,
        address collectionAddress
    ) public onlyOwnerOfNFT(collectionAddress, tokenId, msg.sender) {
        prices[collectionAddress][tokenId] = price;
        typeOfTheListedNFT[collectionAddress][tokenId] = 2;
        emit ListedNFT(
            tokenId,
            msg.sender,
            collectionAddress,
            "bidding",
            price
        );
    }

    function makeOffer(
        uint256 price,
        uint256 tokenId,
        address collectionAddress
    ) public {
        require(prices[collectionAddress][tokenId] < price, "The price is low");
        require(
            typeOfTheListedNFT[collectionAddress][tokenId] != 1,
            "Bid unavailible"
        );
        require(
            token.balanceOf(address(msg.sender)) >= price,
            "Not enough tokens"
        );
        require(
            token.allowance(address(msg.sender), address(this)) >= price,
            "Insufficient allowance"
        );
        prices[collectionAddress][tokenId] = price;
        biders[collectionAddress][tokenId] = address(msg.sender);
        emit MakeOffer(tokenId, collectionAddress, price, address(msg.sender));
    }

    function cancelNFTListing(uint256 tokenId, address collectionAddress)
        public
        onlyOwnerOfNFT(collectionAddress, tokenId, msg.sender)
    {
        delete prices[msg.sender][tokenId];
        delete typeOfTheListedNFT[coll][tokenId];
        delete biders[msg.sender][tokenId];
        emit CancelListing(tokenId, collectionAddress);
    }

    function sellNFT(uint256 tokenId, address collectionAddress) public {
        ERC721 nftCollection = ERC721(collectionAddress);
        require(
            typeOfTheListedNFT[collectionAddress][tokenId] != 1,
            "Not for bid sell"
        );
        require(
            nftCollection.getApproved(tokenId) == address(this),
            "Not approved"
        );

        nftCollection.safeTransferFrom(
            msg.sender,
            biders[collectionAddress][tokenId],
            tokenId
        );
        token.transferFrom(
            biders[collectionAddress][tokenId],
            msg.sender,
            prices[collectionAddress][tokenId]
        );
        emit NFTBought(
            tokenId,
            collectionAddress,
            biders[collectionAddress][tokenId]
        );

        delete prices[collectionAddress][tokenId];
        delete typeOfTheListedNFT[collectionAddress][tokenId];
        delete biders[collectionAddress][tokenId];
    }
}
