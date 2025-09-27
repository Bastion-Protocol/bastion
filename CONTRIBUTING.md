# Contributing to Bastion Protocol

We're thrilled that you're interested in contributing to Bastion Protocol! This guide will help you get started with contributing to our decentralized lending platform.

## 🌟 Ways to Contribute

### Code Contributions
- **Smart Contracts**: Solidity development, security improvements, gas optimizations
- **Frontend**: React/TypeScript UI improvements, new features, bug fixes
- **SDK**: Nitrolite integration enhancements, developer experience improvements
- **Documentation**: API docs, tutorials, examples, translations

### Non-Code Contributions
- **Testing**: Manual testing, automated test improvements, edge case discovery
- **Design**: UI/UX improvements, accessibility enhancements
- **Community**: Discord moderation, user support, content creation
- **Research**: Market analysis, competitive research, regulatory compliance

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16+
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) wallet
- Basic knowledge of Solidity, React, or TypeScript (depending on contribution area)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR-USERNAME/bastion.git
   cd bastion
   ```

2. **Install Dependencies**
   ```bash
   # Install all project dependencies
   npm install
   
   # Install Foundry (for smart contracts)
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. **Set Up Environment**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Add your private key for testing (use a testnet-only key!)
   export PRIVATE_KEY="your_testnet_private_key_here"
   ```

4. **Run Tests**
   ```bash
   # Smart contract tests
   cd bastion-protocol/contracts && forge test
   
   # SDK tests
   cd nitrolite/sdk && npm test
   
   # Frontend tests
   cd bastion-protocol/frontend/bastion-app && npm test
   ```

## 📋 Development Workflow

### 1. Choose an Issue
- Check our [GitHub Issues](https://github.com/Bastion-Protocol/bastion/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to let us know you're working on it

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number
```

### 3. Make Your Changes
- Follow our coding standards (see below)
- Write tests for new functionality
- Update documentation if needed
- Ensure all tests pass

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add your descriptive commit message"
```

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions or modifications
- `chore:` - Build process or auxiliary tool changes

### 5. Push and Create PR
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Link to related issues
- Screenshots for UI changes
- Test results

## 🎨 Coding Standards

### Smart Contracts (Solidity)
- Use Solidity 0.8.20+
- Follow [OpenZeppelin](https://docs.openzeppelin.com/contracts/) patterns
- Include comprehensive NatSpec documentation
- Use meaningful variable and function names
- Implement proper error handling with custom errors
- Add reentrancy guards where necessary

```solidity
/// @title BastionLending - P2P Lending Contract
/// @notice Manages loan creation, funding, and repayment
/// @dev Implements reentrancy protection and access controls
contract BastionLending {
    /// @notice Creates a new loan request
    /// @param amount The loan amount in wei
    /// @param interestRate The interest rate in basis points
    /// @return loanId The unique identifier for the loan
    function createLoan(uint256 amount, uint256 interestRate) 
        external 
        returns (uint256 loanId) {
        // Implementation
    }
}
```

### Frontend (React/TypeScript)
- Use TypeScript for all new code
- Follow React hooks patterns
- Implement proper error boundaries
- Use semantic HTML and accessibility attributes
- Follow mobile-first responsive design
- Use ESLint and Prettier configurations

```typescript
interface LoanFormProps {
  onSubmit: (loan: LoanRequest) => void;
  isLoading: boolean;
}

export const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, isLoading }) => {
  // Implementation
};
```

### SDK (TypeScript)
- Maintain backward compatibility
- Use comprehensive type definitions
- Include JSDoc comments for public APIs
- Implement proper error handling
- Write integration tests

```typescript
/**
 * Creates a new state channel for loan operations
 * @param config Channel configuration
 * @returns Promise resolving to channel ID
 */
export async function createChannel(config: ChannelConfig): Promise<string> {
  // Implementation
}
```

## 🧪 Testing Guidelines

### Smart Contracts
- Test all public functions
- Test edge cases and error conditions
- Use foundry test framework
- Aim for >90% code coverage

```solidity
function testCreateLoan() public {
    uint256 amount = 1000e18;
    uint256 interestRate = 500; // 5%
    
    vm.prank(borrower);
    uint256 loanId = bastionLending.createLoan(amount, interestRate);
    
    assertEq(loanId, 1);
    // Additional assertions
}
```

### Frontend
- Use React Testing Library
- Test user interactions
- Test error states
- Mock external dependencies

```typescript
test('should create loan when form is submitted', async () => {
  render(<LoanForm onSubmit={mockOnSubmit} isLoading={false} />);
  
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: /create loan/i }));
  
  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith({
      amount: '1000',
      // Additional properties
    });
  });
});
```

## 📖 Documentation Standards

- Use clear, concise language
- Include code examples
- Keep documentation up-to-date with code changes
- Use proper markdown formatting
- Include diagrams where helpful

### README Template for New Components
```markdown
# Component Name

Brief description of what the component does.

## Installation
\`\`\`bash
npm install @bastion-protocol/component-name
\`\`\`

## Usage
\`\`\`typescript
import { ComponentName } from '@bastion-protocol/component-name';

const example = new ComponentName(config);
\`\`\`

## API Reference
### Methods
- `methodName(param)` - Description of what it does
```

## 🐛 Reporting Issues

### Bug Reports
Include:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details (OS, browser, wallet)
- Console errors if any

### Feature Requests
Include:
- Clear description of the feature
- Use case and motivation
- Possible implementation approach
- Any related issues or discussions

## 🚀 Release Process

1. **Development**: Feature branches merged to `develop`
2. **Testing**: Comprehensive testing on testnet
3. **Release Candidate**: Create `release/vX.X.X` branch
4. **Security Review**: Internal security review
5. **Deployment**: Deploy to testnet for final validation
6. **Production**: Merge to `main` and deploy

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors list
- Project documentation
- Community Discord channel
- Quarterly contributor spotlight

## 📞 Getting Help

- **Discord**: [Join our developer channel](https://discord.gg/bastionprotocol-dev)
- **GitHub Issues**: [Ask questions](https://github.com/Bastion-Protocol/bastion/issues)
- **Email**: dev@bastionprotocol.com

## 📄 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

### Our Standards
- **Be Respectful**: Treat everyone with respect and professionalism
- **Be Inclusive**: Welcome newcomers and diverse perspectives  
- **Be Collaborative**: Work together and share knowledge
- **Be Patient**: Help others learn and grow
- **Be Open-Minded**: Consider different viewpoints and approaches

## 🎯 Current Priorities

### High Priority
- [ ] Smart contract security improvements
- [ ] UI/UX enhancements for mobile
- [ ] SDK documentation improvements
- [ ] Integration test coverage

### Medium Priority
- [ ] Multi-language support
- [ ] Advanced trust scoring algorithms
- [ ] Performance optimizations
- [ ] Accessibility improvements

### Low Priority
- [ ] Additional chain support
- [ ] Advanced analytics features
- [ ] White-label customization
- [ ] Enterprise features

## 📊 Contributor Metrics

We track contributions through:
- **Code Contributions**: Lines of code, PRs merged
- **Community Engagement**: Discord activity, issue responses
- **Documentation**: Pages written, tutorials created
- **Testing**: Bugs found, test coverage improvements

Thank you for contributing to Bastion Protocol! Together, we're building the future of decentralized finance. 🏛️⚡