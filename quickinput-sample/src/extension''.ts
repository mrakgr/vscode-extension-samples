// My own redesign of the multiStepInput example. 
// Shorter by ~190 lines from the baseline of 310. It is missing the delay for validation.

// This is the half of the MVU pattern. It is shorter than the next example, but it is not a good architecture to use
// when interacting with the world. The state is exposed and that puts you at risk of concurrency bugs.
// For real work you want a proper message pump to isolate the state.

import * as rx from 'rxjs';
import { switchMap, distinctUntilKeyChanged } from 'rxjs/operators';
import { window, ExtensionContext, commands, Disposable, Event, InputBox, QuickPick, QuickPickItem, Uri, QuickInputButton, QuickInputButtons } from 'vscode';

const control = <a extends Disposable>(create: () => a) => (...args: ((arg: a) => rx.Subscription)[]): rx.Observable<a> => {
    return new rx.Observable(o => {
        const x = create();
        const args_ = args.map(f => f(x));
        o.next(x);
        return () => { x.dispose(); args_.forEach(x => x.unsubscribe()); };
    });
};

const do_ = <a>(f: (control: a) => void) => (control: a): rx.Subscription => {
    f(control);
    return rx.Subscription.EMPTY;
};


const event = <a, b>(eventGet: ((control: a) => Event<b>), update: ((control: a) => (value: b) => void)) => (control: a): rx.Subscription => {
    const event = eventGet(control);
    const disp = event(update(control));
    return new rx.Subscription(() => disp.dispose());
};

export function activate(context: ExtensionContext) {
    let v: rx.Subscription;
    context.subscriptions.push(
        { dispose: () => { if (v) { v.unsubscribe(); } } },
        commands.registerCommand('samples.quickInput', () => {
            const enum T { One, OneAlt, Two, Three, Done }
            interface State { stage: T; resourceGroup: string; applicationName: string; 
                runtime: string; steps: number; totalSteps: number; prevState: State | null;}
            const pump = new rx.BehaviorSubject<State>({stage: T.One,resourceGroup:"",
                applicationName:"",runtime:"",steps:1,totalSteps:3,prevState:null});
            const dispatch = (x: State) => pump.next(x); // Note: It is mutating next under the hood, so do not eta-reduce it.

            class MyButton implements QuickInputButton {
                constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
            }

            const buttonAdd = new MyButton({ dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')), light: Uri.file(context.asAbsolutePath('resources/light/add.svg')), }, 'Create Resource Group');

            const title = 'Create Application Service';

            const view = pump.pipe(
                distinctUntilKeyChanged("stage"),
                switchMap((x): rx.Observable<InputBox | QuickPick<QuickPickItem>> => {
                    const buttonBack = [
                        do_((x: QuickPick<QuickPickItem> | InputBox) => { x.buttons = [QuickInputButtons.Back]; }),
                        event((x: QuickPick<QuickPickItem> | InputBox) => x.onDidTriggerButton, _ => btn => {
                            if (btn === QuickInputButtons.Back) { if (x.prevState) {dispatch(x.prevState);} }
                        })
                    ];
                    switch (x.stage) {
                        case T.One: return control(window.createQuickPick)(
                            do_(x => {
                                x.title = title;
                                x.step = 1; x.totalSteps = 3;
                                x.placeholder = 'Pick a resource group';
                                x.items = ['vscode-data-function', 'vscode-appservice-microservices', 'vscode-appservice-monitor', 'vscode-appservice-preview', 'vscode-appservice-prod'].map(label => ({ label }));
                                x.buttons = [buttonAdd];
                            }),
                            event(x => x.onDidTriggerButton, () => btn => { if (btn === buttonAdd) { dispatch({...x,stage:T.OneAlt,prevState:x}); } }),
                            event(x => x.onDidAccept, c => () => dispatch({...x,stage:T.Two,resourceGroup:c.value,steps:2,totalSteps:3,prevState:x})),
                            do_(x => x.show())
                        );
                        case T.OneAlt: return control(window.createInputBox)(
                            do_(x => {
                                x.title = title;
                                x.step = 2; x.totalSteps = 4;
                                x.prompt = "Enter a unique name for the resource group.";
                            }),
                            ...buttonBack,
                            event(x => x.onDidAccept, c => () => dispatch({...x,stage:T.Two,resourceGroup:c.value,steps:3,totalSteps:4,prevState:x})),
                            do_(x => x.show())
                        );
                        case T.Two: return control(window.createInputBox)(
                            do_(c => {
                                c.title = title;
                                c.step = x.steps; c.totalSteps = x.totalSteps;
                                c.prompt = "Enter a unique name for the application.";
                            }),
                            ...buttonBack,
                            event(x => x.onDidAccept, c => () => {
                                if (c.value === "vscode") {c.validationMessage = "The name must be unique.";}
                                else {dispatch({...x,stage:T.Three,applicationName:c.value,steps:x.steps+1,prevState:x});}
                            }),
                            do_(x => x.show())
                        );
                        case T.Three: return control(window.createQuickPick)(
                            do_(c => {
                                c.title = title;
                                c.step = x.steps; c.totalSteps = x.totalSteps;
                                c.placeholder = 'Pick a runtime';
                                c.items = ['Node 8.9', 'Node 6.11', 'Node 4.5'].map(label => ({ label }));
                            }),
                            ...buttonBack,
                            event(x => x.onDidAccept, c => () => dispatch({...x,stage:T.Done,runtime:c.value,prevState:x})),
                            do_(x => x.show())
                        );
                        case T.Done: return new rx.Observable(o => {
                            window.showInformationMessage(`Creating application ${x.applicationName}`);
                            o.complete();
                        });
                    }
                })
            );

            if (v) { v.unsubscribe(); }
            v = view.subscribe();
        }));
}
