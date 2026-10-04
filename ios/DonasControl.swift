import SwiftUI
import UserNotifications
import BackgroundTasks

@main struct DonasControlApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var model=AppModel.shared
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            MainView().environmentObject(model).environmentObject(model.network)
                .tint(Color(red:0.46,green:0.24,blue:0.16))
                .task {
                    await model.requestNotifications()
                    while !Task.isCancelled {
                        await model.synchronize()
                        do { try await Task.sleep(for:.seconds(15)) } catch { break }
                    }
                }
                .onChange(of:scenePhase) { _,phase in
                    if phase == .active { Task { await model.synchronize();await model.registerPush() } }
                    if phase == .background { AppDelegate.scheduleSync() }
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static let syncID="com.bryan.donas.control.refresh"
    func application(_ application: UIApplication,didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey:Any]?=nil) -> Bool {
        UNUserNotificationCenter.current().delegate=self
        BGTaskScheduler.shared.register(forTaskWithIdentifier:Self.syncID,using:nil) { task in
            guard let refresh=task as? BGAppRefreshTask else { task.setTaskCompleted(success:false);return }
            let work=Task { @MainActor in
                Self.scheduleSync()
                do { try await Task.sleep(for:.seconds(11));await AppModel.shared.synchronize();refresh.setTaskCompleted(success:true) }
                catch { refresh.setTaskCompleted(success:false) }
            }
            refresh.expirationHandler = { work.cancel() }
        }
        return true
    }
    static func scheduleSync() {
        let request=BGAppRefreshTaskRequest(identifier:syncID)
        request.earliestBeginDate=Date().addingTimeInterval(15*60)
        try? BGTaskScheduler.shared.submit(request)
    }
    func application(_ application: UIApplication,didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        UserDefaults.standard.set(deviceToken.map { String(format:"%02x",$0) }.joined(),forKey:"apnsToken")
        Task { @MainActor in await AppModel.shared.registerPush() }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter,willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner,.sound])
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter,didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void) {
        Task { @MainActor in AppModel.shared.tab=1;await AppModel.shared.synchronize();completionHandler() }
    }
}
