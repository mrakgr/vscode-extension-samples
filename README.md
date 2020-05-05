# VS Code Extensions Refactor

A fork of the original repo. As an exercise, I did a significant amount of refactoring in the first 30 samples or so. Check out all the repos with `extension'.ts` files. Some of them have minor changes, but for others a significant effort from my own end went into refactoring them. A lot of the samples had broken packages so I fixed that along the way.

I've improved the readability in everything that I've touched, but if I were to pick some highlights here they are:

* `quickinput-sample` - The author went hog wild with Promises in the `multiStepInput.ts` example. Using reactive extensions, I rewrote this so it uses the MVU pattern, and cut the size of the code down by almost a half while significantly improving readability. I am really glad I did this one, as it gave me an opportunity to put what I was studying before to good use.

* `codelens-sample` - This was a relatively straightforward refactor that came out well because the original was so horrible. While the rest of the samples I've looked at were competent (if clumsy in places), whoever wrote this was completely lost while doing it.

* `call-hierarchy-sample` - The second one I tried refactoring and I had to redesign quite a bit. I ended up doing quite a bit of work on this one to make it more functional. I removed whatever code duplication I could find and the result came out better than the original. The original has been doing a bunch of unecessary work that I've eliminated.

* `contentprovider-sample` - Unlike the `quickinput-sample` I tackled this one with the intention of significantly cutting it down and failed at that, but at least I've managed to succeed at making it more readable. 

## Impressions Of Typescript

For a blow by blow account what I've been doing here, see the Spiral repo commits going back two weeks [from here](https://github.com/mrakgr/The-Spiral-Language/commit/9320971e662d67d1edabf55053b4f815334ff1df).

By now I've worked roughly two weeks on this, and it has given me some first hand experience at using Typescript. I am a beginner at JS/TS, but I have significant experience programming in F# and my own language [Spiral](https://github.com/mrakgr/The-Spiral-Language/tree/master). So even though I am programming in a completely new language I am confident in my ability to see what is good code and what is not. When I say readability what I really mean is mental effort needed to understand the code one is studying. So between people, familiarity and their general level will determine the comfort zone of what they find readable. 

As I was doing this I really missed: global type inference, expression based syntax and pattern matching. My view is that I definitely do not want to program in TS unless circumstances force it, but the language does have good points to it. The type system it uses is rather innovative, and it is a definite improvement on vanilla JS. A lot of what is bad in TS, it straight up inherited from JS.

Still, unlike the ML family of languages which have type systems worth emulating, I can tell that despite TS's excellent editor support that puts the rest of the web languages to shame, there is significant complexity in getting all of this to work under the hood.

This has to be praised, but a certain design point in TS sticks out in my mind. `const foo (f : (arg: number) => number) = ...`. Functions are required to have variable names in their type signature. This is just nasty, and really cuddles the monkeys among the JS crowd a bit too much. The reason why it is so nasty is because naming is a really difficult problem, and having to do it for higher order function arguments really discourages style development in the correct direction.

JS could have been so much better if it's syntax wasn't filched from C. One thing I've noticed is that balancing parentheses becomes rather difficult once you try compressing an expression and putting it on the same line - this is something you'd want to do because of readability. Scrolling and flipping between pages takes mental energy, and so harms readability, but the language seems to actively fight the effort to do the right thing by having poor syntax.

It is a pity. I mean, JS did not conquer the world of programming by the merit of its technical excellence. Compared to the effort that has gone to make all this work under the hood, writing a parser is easy in comparison. So you'd expect that there would be more old languages adopting better styles, but that has not happened, instead looking at Bucklescipt to ReasonML transition, the move seems to be happening in the wrong direction. Still at some point, for the BS users at least - the notion that Ocaml's syntax is better should dawn on them.

The JS crowd is hopeless.

The number of good language designs and good language features is limited in amount, and I will do my own to converge on what I think is the best tradeoff. The difficult part of making a good language is due to the fact that a lot of features in the design space actually block other features. So you can do one thing to make your life easier only to have that make your life more difficult in many other areas. JS is a poster child for why language design takes care. It is the biggest wasted oppotunity in the world for doing good PL work.

I do not want to keep programming in TS, if I can help it. Continued usage of it will rot my brain.

## Future

I'll do my own part to create the next version of Spiral with the lessons of 2018 put to good use. The exercise I've done here has been done for the purpose of creating the tooling for it. All the pieces are in place, and I can finally start. Whatever I am missing I know I'll be able to pick up on the fly.

I am finally done with this. The last three months have been too long.