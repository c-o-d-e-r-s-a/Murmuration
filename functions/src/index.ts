import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";

// For cost control, cap concurrent containers per function.
setGlobalOptions({maxInstances: 10});
initializeApp();

export {judgeRound} from "./judgeRound";
