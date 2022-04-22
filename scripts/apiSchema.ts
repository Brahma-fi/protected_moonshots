export interface MovrQuoteSchema {
  success: true;
  result: {
    fromAsset: {
      name: "string";
      address: "string";
      chainId: 0;
      decimals: 0;
      symbol: "string";
      icon: "string";
    };
    fromChainId: 0;
    toAsset: {
      name: "string";
      address: "string";
      chainId: 0;
      decimals: 0;
      symbol: "string";
      icon: "string";
    };
    toChainId: 0;
    routes: [
      {
        allowanceTarget: "string";
        isApprovalRequired: "string";
        routePath: "string";
        middlewareRoute: {
          middlewareId: 0;
          middlewareName: "string";
          middlewareInfo: {
            displayName: "string";
            icon: "string";
          };
          fromAsset: {
            symbol: "string";
            name: "string";
            decimals: 0;
            address: "string";
            eip2612: true;
            icon: "string";
            chainId: 0;
          };
          toAsset: {
            symbol: "string";
            name: "string";
            decimals: 0;
            address: "string";
            eip2612: true;
            icon: "string";
            chainId: 0;
          };
          inputAmount: "string";
          outputAmount: "string";
        };
        bridgeRoute: {
          bridgeName: "string";
          bridgeId: 0;
          bridgeInfo: {
            serviceTime: 0;
            displayName: "string";
            icon: "string";
          };
          fromAsset: {
            name: "string";
            address: "string";
            chainId: 0;
            decimals: 0;
            symbol: "string";
            icon: "string";
          };
          fromChainId: 0;
          toAsset: {
            name: "string";
            address: "string";
            chainId: 0;
            decimals: 0;
            symbol: "string";
            icon: "string";
          };
          toChainId: 0;
          inputAmount: "string";
          outputAmount: "string";
        };
        fees: {};
      }
    ];
    amount: "string";
  };
}

export interface MovrBuildTxnSchema {
  success: true;
  result: {
    tx: {
      to: "string";
      value: {
        type: "string";
        hex: "string";
      };
      data: "string";
    };
    isClaimRequired: true;
    routePath: "string";
  };
}
