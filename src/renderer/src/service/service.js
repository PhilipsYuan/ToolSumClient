const service = {}

export function addService(name, fun) {
    service[name] = fun
}

export function useService(name, param1, param2) {
    service[name](param1, param2)
}