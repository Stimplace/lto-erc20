const LTOToken = artifacts.require('./LTOToken.sol');
const config = require('../config.json');
const tokenConfig = config.token;
const constants = require('./helpers/constants');

contract('LTOToken', ([owner, bridge, intermediate, other]) => {

  describe('when creating a token', () => {
    it('should throw an error if no bridge address is given', async () => {
      try {
        const token = await LTOToken.new(constants.ZERO_ADDRESS, 50);
      } catch (ex) {
        return;
      }
      assert.fail('No error thrown');
    });
  });

  context('created token', () => {
    before(async () => {
      this.token = await LTOToken.new(bridge, 50);
    });

    describe('when creating a new token', () => {
      it('should have correct token info', async () => {
        const name = await this.token.name();
        assert.equal(name, tokenConfig.name);

        const symbol = await this.token.symbol();
        assert.equal(symbol, tokenConfig.symbol);

        const decimals = await this.token.decimals();
        assert(decimals.equals(tokenConfig.decimals));
      });

      it('should have correct token supply', async () => {
        const totalSupply = await this.token.totalSupply();
        assert(totalSupply.equals(0));

        const bridgeSupply = await this.token.bridgeBalance();
        assert(bridgeSupply.equals(50));
      });

      it('should be paused', async () => {
        const paused = await this.token.paused();
        assert.equal(true, paused);
      });

      it('should be ready to be pre-minted', async () => {
        const minted = await this.token.minted();
        assert.equal(false, minted);
      });
    });

    describe('pre-minting tokens', () => {
      before(async () => {
        await this.token.mint(owner, 50);
      });

      it('should result in minted tokens', async () => {
        const totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply.toNumber(), 50);

        const ownerBalance = await this.token.balanceOf(owner);
        assert.equal(ownerBalance.toNumber(), 50);
      });

      it('should not be possible to transfer while pre-minting', async() => {
        try {
          await this.token.transfer(other, 5, {from: owner});
          assert.fail('Not errored');
        } catch (e) {
          assert.equal(e.receipt.status, '0x0', 'Will failure');
        }
      });
    });

    describe('after unpausing the contract', () => {
      before(async () => {
        await this.token.unpause();
      });

      it('should be unpaused', async () => {
        const paused = await this.token.paused();
        assert.equal(false, paused);
      });

      it('should be not ready to be pre-minted', async () => {
        const minted = await this.token.minted();
        assert.equal(true, minted);
      });

      it('should be possible to transfer', async () => {
        await this.token.transfer(intermediate, 2);
        await this.token.transfer(other, 2);

        const balanceIntermediate = await this.token.balanceOf(intermediate);
        assert.equal(balanceIntermediate, 2);

        const balanceOther = await this.token.balanceOf(other);
        assert.equal(balanceOther, 2);
      })
    });

    describe('bridge', () => {
      describe('when adding an intermediate addresses from a non bridge address', () => {
        it('should throw an error', async () => {
          try {
            await this.token.addIntermediateAddress(other);
            assert.fail('Not errored')
          } catch (e) {
            assert.equal(e.receipt.status, '0x0', 'Will failure');
          }
        })
      });

      describe('when adding and confirming an intermediate address from the bridge', () => {

        it('should be pending', async () => {
          const tx = await this.token.addIntermediateAddress(intermediate, {from: bridge});
          assert.equal(tx.receipt.status, '0x1', 'failure');
        });

        it('should be confirmed', async () => {
          const tx = await this.token.confirmIntermediateAddress({from: intermediate});
          assert.equal(tx.receipt.status, '0x1', 'failure');
        });

        it('should have the balance burned', async() => {
          const balance = await this.token.balanceOf(intermediate);
          assert.equal(balance, 0);

          const bridgeBalance = await this.token.bridgeBalance();
          assert.equal(bridgeBalance.toNumber(), 52);

          const totalSupply = await this.token.totalSupply();
          assert.equal(totalSupply.toNumber(), 48);
        });

        describe('when transfering to an intermediate address', async () => {

          it('should forward the funds to the bridge address', async () => {

            const tx = await this.token.transfer(intermediate, 5);

            assert.strictEqual(tx.receipt.status, '0x1', 'failure');
            assert.strictEqual(tx.logs[0].event, 'Transfer');
            assert.strictEqual(tx.logs[0].args.from, owner);
            assert.strictEqual(tx.logs[0].args.to, intermediate);

            const balance = await this.token.balanceOf(intermediate);
            assert.equal(balance.toNumber(), 0);

            const bridgeBalance = await this.token.bridgeBalance();
            assert.equal(bridgeBalance.toNumber(), 57);

            const totalSupply = await this.token.totalSupply();
            assert.equal(totalSupply.toNumber(), 43);
          });
        });
      });

      describe('when adding a foreign address as intermediate address', () => {

        it('should be pending', async () => {
          const tx = await this.token.addIntermediateAddress(other, {from: bridge});
          assert.equal(tx.receipt.status, '0x1', 'failure');
        });

        it('should NOT have the balance burned', async() => {
          const balance = await this.token.balanceOf(other);
          assert.equal(balance, 2);
        });

        describe('when transfering to an unconfirmed intermediate address', async () => {

          it('should NOT forward the funds to the bridge address', async () => {
            const bridgeBalanceOrg = await this.token.bridgeBalance();
            const totalSupplyOrg = await this.token.totalSupply();

            const tx = await this.token.transfer(other, 5);

            assert.strictEqual(tx.receipt.status, '0x1', 'failure');
            assert.strictEqual(tx.logs[0].event, 'Transfer');
            assert.strictEqual(tx.logs[0].args.from, owner);
            assert.strictEqual(tx.logs[0].args.to, other);

            const balance = await this.token.balanceOf(other);
            assert.equal(balance.toNumber(), 7);

            const bridgeBalance = await this.token.bridgeBalance();
            assert.equal(bridgeBalance.toNumber(), bridgeBalanceOrg.toNumber());

            const totalSupply = await this.token.totalSupply();
            assert.equal(totalSupply.toNumber(), totalSupplyOrg.toNumber());
          });
        });
      });
    });
  });
});
