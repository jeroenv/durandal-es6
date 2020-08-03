﻿import viewTemplate from "./welcome.html";

function WelcomeViewModel() {
    this.view = viewTemplate;
    this.modelName = "WelcomeViewModel";

    this.displayName = "Welcome to the Durandal Starter Kit!";
    this.description =
        "Durandal is a cross-device, cross-platform client framework written in JavaScript and designed to make Single Page Applications (SPAs) easy to create and maintain.";
    this.features = [
        "Clean MV* Architecture",
        "JS & HTML Modularity",
        "Simple App Lifecycle",
        "Eventing, Modals, Message Boxes, etc.",
        "Navigation & Screen State Management",
        "Consistent Async Programming w/ Promises",
        "App Bundling and Optimization",
        "Use any Backend Technology",
        "Built on top of jQuery, Knockout",
        "Integrates with other libraries such as SammyJS & Bootstrap",
        "Make jQuery & Bootstrap widgets templatable and bindable (or build your own widgets).",
    ];
}

export default WelcomeViewModel;
