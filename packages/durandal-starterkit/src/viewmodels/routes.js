import Welcome from "./welcome/welcome";
import Binding from "./binding/binding";

export default [
    {
        route: "",
        title: "Welcome",
        moduleId: Welcome,
        nav: true,
    },
    {
        route: "picsum",
        title: "Picsum",
        moduleId: import(/* webpackChunkName: "picsum-viewmodel" */ "./picsum/picsum"),
        nav: true,
    },
    {
        route: "router*details",
        hash: "#router",
        title: "Router",
        moduleId: import(/* webpackChunkName: "router-viewmodel" */ "./router/index"),
        nav: true,
    },
    {
        route: "binding",
        title: "Binding",
        moduleId: Binding,
        nav: true,
    },
    {
        route: "widgets",
        title: "Widgets",
        moduleId: import(/* webpackChunkName: "widgets-viewmodel" */ "./widgets/widgets"),
        nav: true,
    },
    {
        route: "components",
        title: "Components",
        moduleId: import(/* webpackChunkName: "components-viewmodel" */ "./ko-components/ko-components"),
        nav: true,
    },
];
