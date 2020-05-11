﻿import ko from "knockout";
import { app } from "durandal/core";
import router from "durandal/plugins/router";

import viewTemplate from "./shell.html";
import routes from "../routes";

class ShellViewModel {
    constructor() {
        this.view = viewTemplate;
        this.viewName = "Shell";

        this.isExpanded = ko.observable(false);
        this.toggle = () => {
            this.isExpanded(!this.isExpanded());
        };
        this.closeToggle = () => {
            const toggleInput = document.getElementsByClassName("navbar-toggle")[0];
            if (toggleInput && this.isExpanded()) {
                toggleInput.click();
            }
            return true;
        };
    }

    // eslint-disable-next-line class-methods-use-this
    search() {
        // It's really easy to show a message box.
        // You can add custom options too. Also, it returns a promise for the user's response.
        app.showMessage("Search not yet implemented...");
    }

    // eslint-disable-next-line class-methods-use-this
    activate() {
        router.map(routes).buildNavigationModel();

        return router.activate();
    }
}

const Shell = new ShellViewModel();

export default Shell;
