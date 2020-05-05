A fork of the original repo. I did a significant amount of refactoring in the first 30 samples or so. Check out all the repos with `extension'.ts` files. Those are my own work. A lot of the samples had broken packages so I fixed that along the way.

I've improved the readability in everything that, but if I were to pick some highlights here they are:

* `quickinput-sample` - The author went hog wild with Promises in the `multiStepInput.ts` example. I rewrote this so it uses the MVU pattern, and cut the size of the code down by almost a half while significantly improving readability.