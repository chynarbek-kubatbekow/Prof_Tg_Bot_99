export function botSessionData() {
  return {
    waitingForAI: false,
    waitingForName: false,
    waitingForPhone: false,
    waitingForDirection: false,
    waitingForComment: false,
    userName: "",
    userPhone: "",
    userDirection: "",
    adminAction: null,
  };
}
