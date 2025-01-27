import { useCallback, useState, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { useWaitForTransactionReceipt } from "@worldcoin/minikit-react";
import { createPublicClient, http } from "viem";
import { worldchain } from "wagmi/chains";
import { MAGNIFY_WORLD_ADDRESS, WORLDCOIN_CLIENT_ID, WORLDCOIN_TOKEN_COLLATERAL } from "@/utils/constants";

type LoanDetails = {
  amount: number;
  interest: number;
  totalDue: number;
  transactionId: string;
};

const useRepayLoan = () => {
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

  const client = createPublicClient({
    chain: worldchain,
    transport: http("https://worldchain-mainnet.g.alchemy.com/public"),
  });

  const { isLoading: isConfirmingTransaction, isSuccess: isTransactionConfirmed } =
    useWaitForTransactionReceipt({
      client: client,
      transactionId: transactionId || "",
      appConfig: {
        app_id: WORLDCOIN_CLIENT_ID,
      },
    });

  useEffect(() => {
    setIsConfirming(isConfirmingTransaction);
    setIsConfirmed(isTransactionConfirmed);
  }, [isConfirmingTransaction, isTransactionConfirmed]);

  const repayLoanWithPermit2 = useCallback(async (loanAmount: string) => {
    setError(null);
    setTransactionId(null);
    setIsConfirming(false);
    setIsConfirmed(false);
    setLoanDetails(null);

    try {
      const deadline = Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString();

      // Create Permit2 transfer parameters
      const permitTransfer = {
        permitted: {
          token: WORLDCOIN_TOKEN_COLLATERAL,
          amount: loanAmount,
        },
        nonce: Date.now().toString(),
        deadline,
      };

      // Format transfer details
      const transferDetails = {
        to: MAGNIFY_WORLD_ADDRESS,
        requestedAmount: loanAmount,
      };

      // Format arguments for the contract call
      const permitTransferArgsForm = [
        [permitTransfer.permitted.token, permitTransfer.permitted.amount],
        permitTransfer.nonce,
        permitTransfer.deadline,
      ];

      const transferDetailsArgsForm = [transferDetails.to, transferDetails.requestedAmount];

      const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: MAGNIFY_WORLD_ADDRESS,
            abi: [
              {
                inputs: [
                  {
                    components: [
                      {
                        components: [
                          {
                            internalType: "address",
                            name: "token",
                            type: "address",
                          },
                          {
                            internalType: "uint256",
                            name: "amount",
                            type: "uint256",
                          },
                        ],
                        internalType: "struct ISignatureTransfer.TokenPermissions",
                        name: "permitted",
                        type: "tuple",
                      },
                      {
                        internalType: "uint256",
                        name: "nonce",
                        type: "uint256",
                      },
                      {
                        internalType: "uint256",
                        name: "deadline",
                        type: "uint256",
                      },
                    ],
                    internalType: "struct ISignatureTransfer.PermitTransferFrom",
                    name: "permitTransferFrom",
                    type: "tuple",
                  },
                  {
                    components: [
                      {
                        internalType: "address",
                        name: "to",
                        type: "address",
                      },
                      {
                        internalType: "uint256",
                        name: "requestedAmount",
                        type: "uint256",
                      },
                    ],
                    internalType: "struct ISignatureTransfer.SignatureTransferDetails",
                    name: "transferDetails",
                    type: "tuple",
                  },
                  {
                    internalType: "bytes",
                    name: "signature",
                    type: "bytes",
                  },
                ],
                name: "repayLoanWithPermit2",
                outputs: [],
                stateMutability: "nonpayable",
                type: "function",
              },
            ],
            functionName: "repayLoanWithPermit2",
            args: [permitTransferArgsForm, transferDetailsArgsForm, "PERMIT2_SIGNATURE_PLACEHOLDER_0"],
          },
        ],
        permit2: [
          {
            ...permitTransfer,
            spender: MAGNIFY_WORLD_ADDRESS,
          },
        ],
      });

      if (finalPayload.status === "success") {
        setTransactionId(finalPayload.transaction_id);
        console.log("Loan repayment transaction sent:", finalPayload.transaction_id);

        setLoanDetails({
          amount: parseInt(loanAmount),
          interest: 0, // Calculate based on contract terms
          totalDue: parseInt(loanAmount), // Calculate total with interest
          transactionId: finalPayload.transaction_id,
        });
      } else {
        console.error("Error sending transaction", finalPayload, commandPayload);
        setError(`Transaction failed: ${finalPayload.details.simulationError.split("string: ")[1]}`);
      }
    } catch (err) {
      console.error("Error sending transaction", err);
      setError(`Transaction failed: ${(err as Error).message}`);
    }
  }, []);

  return {
    repayLoanWithPermit2,
    error,
    transactionId,
    isConfirming,
    isConfirmed,
    loanDetails,
  };
};

export default useRepayLoan;
