// My own redesign of the multiStepInput example. 
// Shorter by ~130 LOC from the baseline of 310. Is significantly more readable than the original while retaining full capability.

// Here is the full MVU pattern. Pioneered by Elm, it is easy to replicate using reactive extensions.
// To see how much nicer the whole thing could be if it were written in F# (on a similar example) check out:
// https://github.com/mrakgr/Lithe-POC

import * as rx from 'rxjs';
import { scan, publishBehavior, map, switchMap, distinctUntilChanged, distinctUntilKeyChanged, delay } from 'rxjs/operators';
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

const prop = <a, b>(f: (control: a, value: b) => void, value: rx.Observable<b>) => (control: a): rx.Subscription => {
    return value.subscribe(value => f(control, value));
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
            const enum Stage { One, OneAlt, Two, Three, Done }
            const enum T { SelectResourceGroupDirectInput, GoBack, SelectResourceGroup, ValidateApplicationName, ErrorApplicationName, SelectApplicationName, SelectRuntime }
            type Message =
                { tag: T.SelectResourceGroupDirectInput }
                | { tag: T.GoBack }
                | { tag: T.SelectResourceGroup, resourceGroup: string }
                | { tag: T.ValidateApplicationName, applicationName: string }
                | { tag: T.ErrorApplicationName, applicationName: string }
                | { tag: T.SelectApplicationName, applicationName: string }
                | { tag: T.SelectRuntime, runtime: string };
            type ApplicationName = { ok: string } | { validating: string } | { error: string } | null;
            interface State {
                stage: Stage; resourceGroup: string; applicationName: ApplicationName;
                runtime: string; step: number; totalSteps: number; prevState: State | null;
            }
            const pump = new rx.Subject<Message>();
            // Note: It is mutating next under the hood, so do not eta-reduce it.
            // Also, setImmediate is needed to keep the messages in the right order.
            const dispatch = (x: Message) => setImmediate(() => pump.next(x));
            const init: State = { stage: Stage.One, resourceGroup: "", applicationName: null, runtime: "", step: 1, totalSteps: 3, prevState: null };
            const update = pump.pipe(
                scan((x, m): State => {
                    switch (m.tag) {
                        case T.SelectResourceGroupDirectInput: return { ...x, stage: Stage.OneAlt, step: 2, totalSteps: 4, prevState: x };
                        case T.GoBack: return x.prevState ? x.prevState : x;
                        case T.SelectResourceGroup: return { ...x, stage: Stage.Two, resourceGroup: m.resourceGroup, step: x.step + 1, prevState: x };
                        case T.ValidateApplicationName: return { ...x, applicationName: { validating: m.applicationName } };
                        case T.ErrorApplicationName:
                            if (x.applicationName && "validating" in x.applicationName && x.applicationName.validating === m.applicationName) {
                                return { ...x, applicationName: { error: m.applicationName } };
                            } else { return x; }
                        case T.SelectApplicationName:
                            if (x.applicationName && "validating" in x.applicationName && x.applicationName.validating === m.applicationName) {
                                return { ...x, stage: Stage.Three, applicationName: { ok: m.applicationName }, step: x.step + 1, prevState: x };
                            } else { return x; }
                        case T.SelectRuntime: return { ...x, stage: Stage.Done, runtime: m.runtime, prevState: x };
                    }
                }, init),
                publishBehavior(init)
            ) as rx.ConnectableObservable<State>;

            const appName = update.pipe(
                map(x => x.applicationName),
                distinctUntilChanged(),
            );
            const appIsError: rx.Observable<string | undefined> = appName.pipe(map(x => {
                if (x && "error" in x) { return `The name must be unique. ${x.error} is already taken.`; }
            }));
            const appIsBusy: rx.Observable<boolean> = appName.pipe(map(x => x && "validating" in x ? true : false));

            const cmdValidator: rx.Observable<Message> = appName.pipe(
                // Be careful not to pass in rx.empty
                switchMap((x): rx.Observable<string> => x && "validating" in x ? rx.of(x.validating) : rx.EMPTY),
                distinctUntilChanged(),
                // I could use a regular map followed by a delay, but the delay here represents some expensive operation
                // so it is better to switch to the next input rather than process the previous one to completion.
                switchMap(x => {
                    const msg: Message = x !== "vscode" ? { tag: T.SelectApplicationName, applicationName: x } : { tag: T.ErrorApplicationName, applicationName: x };
                    return rx.of(msg).pipe(delay(1000));
                })
            );

            // In this example there is only cmdValidator so merging is redundant, but in a serious program this is where
            // multiple commands should be merged before being passed on to the message dispatcher.
            const cmds = rx.merge(cmdValidator);

            class MyButton implements QuickInputButton {
                constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
            }

            const buttonAdd = new MyButton({ dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')), light: Uri.file(context.asAbsolutePath('resources/light/add.svg')), }, 'Create Resource Group');

            const title = 'Create Application Service';

            const view = update.pipe(
                distinctUntilKeyChanged("stage"),
                switchMap((x): rx.Observable<InputBox | QuickPick<QuickPickItem>> => {
                    const buttonBack = [
                        do_((x: QuickPick<QuickPickItem> | InputBox) => { x.buttons = [QuickInputButtons.Back]; }),
                        event((x: QuickPick<QuickPickItem> | InputBox) => x.onDidTriggerButton, _ => btn => {
                            if (btn === QuickInputButtons.Back) { if (x.prevState) { dispatch({ tag: T.GoBack }); } }
                        })
                    ];
                    switch (x.stage) {
                        case Stage.One: return control(window.createQuickPick)(
                            do_(c => {
                                c.title = title;
                                c.step = x.step; c.totalSteps = x.totalSteps;
                                c.placeholder = 'Pick a resource group';
                                c.items = ['vscode-data-function', 'vscode-appservice-microservices', 'vscode-appservice-monitor', 'vscode-appservice-preview', 'vscode-appservice-prod'].map(label => ({ label }));
                                c.buttons = [buttonAdd];
                            }),
                            event(x => x.onDidTriggerButton, () => btn => { if (btn === buttonAdd) { dispatch({ tag: T.SelectResourceGroupDirectInput }); } }),
                            event(x => x.onDidAccept, c => () => dispatch({ tag: T.SelectResourceGroup, resourceGroup: c.selectedItems[0].label })),
                            do_(x => x.show())
                        );
                        case Stage.OneAlt: return control(window.createInputBox)(
                            do_(c => {
                                c.title = title;
                                c.step = x.step; c.totalSteps = x.totalSteps;
                                c.prompt = "Enter a unique name for the resource group.";
                            }),
                            ...buttonBack,
                            event(x => x.onDidAccept, c => () => dispatch({ tag: T.SelectResourceGroup, resourceGroup: c.value })),
                            do_(x => x.show())
                        );
                        case Stage.Two: return control(window.createInputBox)(
                            do_(c => {
                                c.title = title;
                                c.step = x.step; c.totalSteps = x.totalSteps;
                                c.prompt = "Enter a unique name for the application.";
                            }),
                            ...buttonBack,
                            prop((c, v) => { c.validationMessage = v; }, appIsError),
                            prop((c, v) => { c.busy = v; }, appIsBusy),
                            event(x => x.onDidAccept, c => () => { dispatch({ tag: T.ValidateApplicationName, applicationName: c.value }); }),
                            do_(x => x.show())
                        );
                        case Stage.Three: return control(window.createQuickPick)(
                            do_(c => {
                                c.title = title;
                                c.step = x.step; c.totalSteps = x.totalSteps;
                                c.placeholder = 'Pick a runtime';
                                c.items = ['Node 8.9', 'Node 6.11', 'Node 4.5'].map(label => ({ label }));
                            }),
                            ...buttonBack,
                            event(x => x.onDidAccept, c => () => dispatch({ tag: T.SelectRuntime, runtime: c.selectedItems[0].label })),
                            do_(x => x.show())
                        );
                        case Stage.Done: return new rx.Observable(o => {
                            if (x.applicationName && "ok" in x.applicationName) {
                                window.showInformationMessage(`Creating application ${x.applicationName.ok}`);
                                o.complete();
                            }
                            else { o.error(new Error("Programing error: Invalid state in Done.")); }
                        });
                    }
                })
            );

            if (v) { v.unsubscribe(); }
            const subs = [cmds.subscribe(dispatch), view.subscribe(), update.connect()];
            v = new rx.Subscription(() => subs.forEach(x => x.unsubscribe()));
        }));
}
