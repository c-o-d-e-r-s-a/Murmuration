import { ROLES } from "../../shared/contracts";

document.querySelector("#app")!.textContent = `screen — dials: ${ROLES.join(", ")}`;
