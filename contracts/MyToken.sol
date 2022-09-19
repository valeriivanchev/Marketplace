//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MyToken is ERC20 {
    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) {
       
    }

    function mint()public{
         uint256 n = 1000;
        _mint(msg.sender, n * 10**uint(decimals()));
    }
}