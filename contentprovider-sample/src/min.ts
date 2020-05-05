import * as rx from "rxjs";
import { scan, startWith } from "rxjs/operators";

const o = rx.of(1,2,3);
const r = rx.zip(
	o,
	o.pipe(scan((a,b) => a+b, 0), startWith(0)),
).subscribe(x => console.log(x),undefined,() => console.log("Complete"));