type S = {
    a: ([] : []) => number;
    b: ([a]: [number]) => number;
    c: ([a,b] : [number,number]) => number;
};

const x: S = {
    a: ([]) => { return 0; },
    b: ([a]) => { return a; },
    c: ([a,b]) => { return a + b; }
};

const g = (d : S, str : keyof S, arg: any) => {
    return d[str](arg);
};