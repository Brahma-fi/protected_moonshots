/// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface IMetaRouter{

    function keeper() external view returns (address);
    function governance() external view returns (address);
    function wantToken() external view returns (address);
}