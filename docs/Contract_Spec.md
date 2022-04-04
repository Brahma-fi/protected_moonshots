# Guidelines for Contracts
## On Documentation
- Divide the contract into sections based on the operation that is performed. 
- Define the variables and events related to section in the contract.
- Natspec any function that performs a complex operation with `@dev` comments suggestion any failure/gotchas to keep in mind while calling it.
- Use `@notice` comments to describe the function operation.
- If a modifier is being used in more than one place use a inline function instead.
- Follow the `Hauler.md` template for the contract documentation.



