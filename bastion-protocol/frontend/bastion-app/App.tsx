import React, { useState } from 'react';
import { ethers } from 'ethers';
import { createLendingSession } from './nitrolite-client';

const App = () => {
  const [loanAmount, setLoanAmount] = useState('');

  const createLoan = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const borrower = await signer.getAddress();
    const lender = '0xLenderAddress'; // From input or selection
    await createLendingSession(borrower, lender, loanAmount);
  };

  return (
    <div>
      <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="Loan Amount" />
      <button onClick={createLoan}>Create Loan</button>
    </div>
  );
};

export default App;
