import * as us from "underscore";

const t = [
	{a:1, b:"qwe"},
	{a:2, b:"asd"},
	{a:2, b:"zxc"}
];

const r = us.groupBy(t,x => x.a);
const r$ = us.map(r,(value,key) => key);

console.log(r$);